import re, uuid, bcrypt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from database import db, users_collection, reset_tokens_collection
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()
bearer = HTTPBearer()


def clean_identifier(s: str) -> str:
    s = s.strip()
    if "@" in s:
        return s.lower()
    cleaned = re.sub(r'[\s\-\(\)\+]', '', s)
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    return cleaned


def make_token(user_id: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "exp": exp},
                      SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer)
):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY,
                             algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Token expired — please login again")

    user = await users_collection.find_one({"_id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def admin_only(user=Depends(get_current_user)):
    """
    Legacy gate: any staff member (admin OR manager).

    Kept because several routes still import it, but prefer the explicit
    guards in core.rbac — `require_admin` for organisation-wide control and
    `require_staff` (plus `visibility_filter`) for oversight screens where a
    manager should see only their own reports.
    """
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Manager or administrator access required")
    return user


# The three consoles an account can be created against. Mirrors ROLES in
# frontend/src/components/RoleChoice.tsx — keep the two in step.
VALID_ROLES = ("admin", "manager", "user")


class RegisterBody(BaseModel):
    name:       str
    identifier: str
    password:   str
    # Which console this account is created against. Validated against
    # VALID_ROLES below; anything unrecognised falls back to "user".
    role:       str | None = None


class LoginBody(BaseModel):
    identifier: str
    password:   str
    # Which console the person intends to open. This NEVER grants anything —
    # the role always comes from the database. It is only compared against the
    # stored role so someone who picks the wrong door is told so plainly
    # instead of silently landing in a console they didn't expect.
    expected_role: str | None = None


@router.post("/register")
async def register(body: RegisterBody):
    name  = body.name.strip()
    ident = body.identifier.strip()
    pw    = body.password

    # ── Validation ──────────────────────────────────────────────
    if not name or len(name) < 2:
        raise HTTPException(400, "Enter your full name")
    if not ident:
        raise HTTPException(400, "Enter your email or phone number")
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    has_at    = "@" in ident
    is_digits = re.sub(r'[\s\-\+\(\)]', '', ident).isdigit()
    if not has_at and not is_digits:
        raise HTTPException(
            400,
            "Enter a valid email (you@gmail.com) or phone number (9876543210)"
        )

    # ── Role — chosen at signup ─────────────────────────────────
    # Validated against the known set rather than stored verbatim, so a
    # malformed or invented role can never reach the database; anything
    # unrecognised (or omitted, as older clients do) becomes a plain user.
    #
    # NOTE: this endpoint is public, so an account can self-select
    # administrator. That is deliberate here — the product needs all three
    # consoles reachable without a pre-seeded admin. If this is ever exposed
    # beyond a trusted audience, gate elevated roles behind an invitation or
    # allow self-selected admin only while the workspace has no admin yet.
    role = (body.role or "").strip().lower()
    if role not in VALID_ROLES:
        role = "user"

    cid = clean_identifier(ident)

    # ── Duplicate check ──────────────────────────────────────────
    existing = await users_collection.find_one({
        "$or": [
            {"email": cid}, {"phone": cid},
            {"email": ident.lower()}, {"phone": ident},
        ]
    })
    if existing:
        raise HTTPException(
            400,
            "An account with this email/phone already exists. Please login."
        )

    # ── Create user ──────────────────────────────────────────────
    pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    uid     = str(uuid.uuid4())

    doc = {
        "_id":          uid,
        "name":         name,
        "role":         role,   # ← stored exactly as chosen
        "password":     pw_hash,
        "avatar_color": "#6366f1",
        "language":     "en",
        "created_at":   datetime.utcnow(),
        "dob":          "",
        "email":        cid if has_at    else "",
        "phone":        cid if is_digits else "",
    }
    await users_collection.insert_one(doc)
    token = make_token(uid, role)

    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         role,
        "name":         name,
        "user_id":      uid,
    }


@router.post("/login")
async def login(body: LoginBody):
    ident = body.identifier.strip()
    if not ident:
        raise HTTPException(400, "Enter your email or phone")

    cid = clean_identifier(ident)

    user = await users_collection.find_one({
        "$or": [
            {"email": cid},
            {"phone": cid},
            {"email": ident.lower()},
            {"phone": ident},
        ]
    })

    if not user:
        raise HTTPException(
            401,
            "No account found with this email/phone. Please register first."
        )

    try:
        ok = bcrypt.checkpw(body.password.encode(), user["password"].encode())
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(401, "Wrong password. Please try again.")

    # ── Return the role EXACTLY as stored in DB ──────────────────
    # The client may say which console it expected; that is only ever used to
    # reject a mismatch. It can never widen access, because the token is signed
    # with `stored_role` regardless of what was requested.
    stored_role = user.get("role", "user")

    wanted = (body.expected_role or "").strip().lower()
    if wanted and wanted in VALID_ROLES and wanted != stored_role:
        label = {"admin": "an administrator", "manager": "a manager", "user": "an employee"}
        raise HTTPException(
            403,
            f"This account is registered as {label[stored_role]}, not {label[wanted]}. "
            f"Sign in as {label[stored_role]} instead, or ask your administrator to change your access.",
        )

    token = make_token(user["_id"], stored_role)

    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         stored_role,
        "name":         user["name"],
        "user_id":      user["_id"],
    }


@router.post("/forgot-password")
async def forgot_password(body: dict):
    ident = (body.get("identifier") or "").strip()
    cid   = clean_identifier(ident)
    user  = await users_collection.find_one(
        {"$or": [{"email": cid}, {"phone": cid}]}
    )
    if not user:
        raise HTTPException(404, "No account found")
    tok = str(uuid.uuid4())
    await reset_tokens_collection.insert_one({
        "_id":        tok,
        "user_id":    user["_id"],
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "used":       False,
    })
    return {"message": "Reset link created", "token": tok}


@router.post("/reset-password")
async def reset_password(body: dict):
    tok = (body.get("token") or "").strip()
    pw  = (body.get("new_password") or "").strip()
    if not tok or len(pw) < 6:
        raise HTTPException(400, "Token and password (min 6 chars) required")
    doc = await reset_tokens_collection.find_one({"_id": tok, "used": False})
    if not doc or doc["expires_at"] < datetime.utcnow():
        raise HTTPException(400, "Invalid or expired token")
    ph = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    await users_collection.update_one(
        {"_id": doc["user_id"]}, {"$set": {"password": ph}}
    )
    await reset_tokens_collection.update_one(
        {"_id": tok}, {"$set": {"used": True}}
    )
    return {"message": "Password changed successfully"}
