import logging
import re, uuid, bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel, ConfigDict
from database import db, users_collection, reset_tokens_collection
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from core.config import get_settings
from repositories.organizations import OrganizationsRepository
from services.email_alert_service import send_password_reset_email

log = logging.getLogger("securedesk.auth")

router = APIRouter()
bearer = HTTPBearer()


async def ensure_personal_org(user: dict) -> dict:
    """
    Guarantee `user` has an org_id, creating a personal organisation if not.

    This is what makes org_id mandatory rather than optional: every account
    that authenticates — freshly registered, or an older account from before
    this existed — leaves this function with one. TenantScopedRepository
    raises on a falsy org_id by design (see repositories/base.py); this is
    the one place that guarantee gets made true, so nothing downstream needs
    a "what if there's no org" branch.

    One organisation per user, never grouped by email domain — same rule the
    Phase 2 migration script uses for existing data, applied here going
    forward for new and self-healing accounts instead. A user who wants to
    share an organisation with colleagues does so explicitly afterward
    (POST /api/org/create, invite flow), not by an inferred match.

    Idempotent: a user who already has org_id is returned unchanged, so this
    is safe to call on every register() and every login().
    """
    if user.get("org_id"):
        return user

    from core.database import get_database
    org_repo = OrganizationsRepository(get_database())
    org_id = str(uuid.uuid4())
    await org_repo.create(
        org_id=org_id,
        name=f"{user.get('name') or user['_id']}'s organisation",
        owner_id=user["_id"],
    )
    await users_collection.update_one({"_id": user["_id"]}, {"$set": {"org_id": org_id}})
    user["org_id"] = org_id
    return user


def clean_identifier(s: str) -> str:
    s = s.strip()
    if "@" in s:
        return s.lower()
    cleaned = re.sub(r'[\s\-\(\)\+]', '', s)
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    return cleaned


def make_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
    # Self-heals any account from before org_id was mandatory (see
    # ensure_personal_org). Idempotent and near-free once the field is set —
    # this is what lets every route depend on org_id always being present
    # without a migration having to run first.
    return await ensure_personal_org(user)


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


# The roles an account may hold. Registration can no longer select among
# these — see register() — but login still compares against them so someone
# who opens the wrong console is told so plainly.
VALID_ROLES = ("admin", "manager", "user")

# The only role a public registration can ever produce.
USER_ROLE = "user"


class RegisterBody(BaseModel):
    # Unknown fields are rejected, so the request shape stays a closed set and
    # a future privileged field can't be smuggled in by a stale client.
    model_config = ConfigDict(extra="forbid")

    name:       str
    identifier: str
    password:   str

    # Accepted and then ignored, deliberately.
    #
    # This field used to choose the new account's role, which let anyone on
    # the internet register as an administrator. It is declared here — rather
    # than rejected outright by extra="forbid" — only so that clients still
    # sending it get a normal 200 and a plain user account instead of a 422.
    # A single push can deploy frontend and backend in either order, so the
    # backend must not depend on the frontend going first.
    #
    # register() never reads this. Do not start.
    role: str | None = None


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

    # ── Role — never chosen by the caller ───────────────────────
    # Registration is public and unauthenticated, so it always produces a
    # plain user. It previously honoured a `role` field from the request
    # body, which meant anyone on the internet could create themselves an
    # administrator account. `body.role` is still accepted by the model for
    # backward compatibility and is deliberately never read here.
    #
    # Elevation is a separate, authenticated, admin-only operation:
    #   PATCH /api/admin/users/{user_id}/role   (see routes/admin.py)
    # To create the very first admin in a fresh install, run
    #   python -m scripts.promote_user <email-or-phone> admin
    # which requires shell access to the deployment.
    role = USER_ROLE

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
        "role":         role,   # always USER_ROLE — see above
        "password":     pw_hash,
        "avatar_color": "#6366f1",
        "language":     "en",
        "created_at":   datetime.now(timezone.utc),
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


# Shown for every /forgot-password call, whatever the outcome. Constant by
# design: a different message for a known vs unknown account turns this
# endpoint into a user-enumeration oracle.
_RESET_ACK = (
    "If an account exists for that email or phone, we've sent a reset link. "
    "Check your inbox, including spam."
)


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: dict):
    """
    Start a password reset. Always 202, always the same body.

    Two holes closed here:

    1. The reset token used to be returned in this response. Anyone who knew
       a person's email or phone could mint a valid token and take the account
       over without ever touching their inbox. The token now leaves the server
       only by email, and is never serialised into an API response.
    2. A missing account used to 404 while a real one returned a token, so the
       endpoint confirmed which emails and phone numbers were registered.

    Delivery is email-only. Until SMTP is configured the flow is inert and no
    token is minted at all — a token that cannot be delivered can only leak.
    """
    settings = get_settings()

    if not settings.password_reset_enabled:
        # Deliberately still 202: we don't advertise which capabilities are
        # switched off. The operator sees the real reason in the log.
        log.warning("password reset requested but SMTP is not configured; flow is disabled")
        return {"message": _RESET_ACK}

    ident = (body.get("identifier") or "").strip()
    cid   = clean_identifier(ident)
    user  = await users_collection.find_one(
        {"$or": [{"email": cid}, {"phone": cid}]}
    )

    if user and user.get("email"):
        tok = str(uuid.uuid4())
        await reset_tokens_collection.insert_one({
            "_id":        tok,
            "user_id":    user["_id"],
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used":       False,
        })
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={tok}"
        # smtplib is blocking; keep it off the event loop.
        await run_in_threadpool(
            send_password_reset_email, user["email"], user.get("name", "there"), reset_url
        )

    return {"message": _RESET_ACK}


@router.post("/reset-password")
async def reset_password(body: dict):
    if not get_settings().password_reset_enabled:
        raise HTTPException(
            503, "Password reset is temporarily unavailable. Please contact your administrator."
        )
    tok = (body.get("token") or "").strip()
    pw  = (body.get("new_password") or "").strip()
    if not tok or len(pw) < 6:
        raise HTTPException(400, "Token and password (min 6 chars) required")
    doc = await reset_tokens_collection.find_one({"_id": tok, "used": False})
    if not doc or doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired token")
    ph = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    await users_collection.update_one(
        {"_id": doc["user_id"]}, {"$set": {"password": ph}}
    )
    await reset_tokens_collection.update_one(
        {"_id": tok}, {"$set": {"used": True}}
    )
    return {"message": "Password changed successfully"}
