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

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
PHONE_RE = re.compile(r'^[6-9]\d{9}$')


def is_email(s: str) -> bool:
    return bool(EMAIL_RE.match(s.strip()))

def is_phone(s: str) -> bool:
    cleaned = re.sub(r'[\s\-\(\)\+]', '', s.strip())
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    return bool(PHONE_RE.match(cleaned))

def clean_id(s: str) -> str:
    s = s.strip()
    if is_email(s):
        return s.lower()
    cleaned = re.sub(r'[\s\-\(\)\+]', '', s)
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    return cleaned


class RegisterBody(BaseModel):
    name: str
    identifier: str
    password: str
    role: str = "user"

class LoginBody(BaseModel):
    identifier: str
    password: str


def make_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Token expired or invalid — please login again")
    user = await users_collection.find_one({"_id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return user


@router.post("/register")
async def register(body: RegisterBody):
    ident = body.identifier.strip()

    if not ident:
        raise HTTPException(400, "Enter your email or phone number")

    # Accept ANYTHING as identifier — just must not be empty
    # But give a hint if it looks wrong
    if len(ident) < 3:
        raise HTTPException(400, "Enter a valid email or 10-digit phone number")

    # Check if it looks like neither email nor phone — still allow but warn
    looks_like_email = "@" in ident
    looks_like_phone = ident.replace(" ","").replace("+","").replace("-","").isdigit()

    if not looks_like_email and not looks_like_phone:
        raise HTTPException(400, f"'{ident}' doesn't look like an email or phone. Try: you@gmail.com or 9876543210")

    identifier_clean = clean_id(ident)

    if not body.name or len(body.name.strip()) < 2:
        raise HTTPException(400, "Enter your full name")

    if not body.password or len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    role = body.role.lower() if body.role.lower() in ("user","manager","admin") else "user"

    # Check duplicate
    existing = await users_collection.find_one({
        "$or": [{"email": identifier_clean}, {"phone": identifier_clean},
                {"email": ident.lower()}, {"phone": ident}]
    })
    if existing:
        raise HTTPException(400, "Account already exists with this email/phone. Please login.")

    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    uid = str(uuid.uuid4())

    doc = {
        "_id": uid, "name": body.name.strip(), "role": role,
        "password": pw_hash, "avatar_color": "#6366f1",
        "language": "en", "created_at": datetime.utcnow(), "dob": "",
        "email": identifier_clean if looks_like_email else "",
        "phone": identifier_clean if looks_like_phone else "",
    }
    await users_collection.insert_one(doc)
    token = make_token(uid, role)
    return {"access_token": token, "token_type": "bearer", "role": role, "name": body.name.strip(), "user_id": uid}


@router.post("/login")
async def login(body: LoginBody):
    ident = body.identifier.strip()
    if not ident:
        raise HTTPException(400, "Enter your email or phone")

    cid = clean_id(ident)
    user = await users_collection.find_one({
        "$or": [
            {"email": cid}, {"phone": cid},
            {"email": ident.lower()}, {"phone": ident},
            {"email": ident}, {"phone": cid},
        ]
    })

    if not user:
        raise HTTPException(401, "No account found. Check your email/phone or register first.")

    try:
        ok = bcrypt.checkpw(body.password.encode(), user["password"].encode())
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(401, "Wrong password. Try again.")

    token = make_token(user["_id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "name": user["name"], "user_id": user["_id"]}


@router.post("/forgot-password")
async def forgot_password(body: dict):
    ident = (body.get("identifier") or "").strip()
    cid   = clean_id(ident)
    user  = await users_collection.find_one({"$or": [{"email": cid}, {"phone": cid}]})
    if not user:
        raise HTTPException(404, "No account found with this email/phone")
    tok = str(uuid.uuid4())
    await reset_tokens_collection.insert_one({
        "_id": tok, "user_id": user["_id"],
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "used": False,
    })
    return {"message": "Reset token created", "token": tok}


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
    await users_collection.update_one({"_id": doc["user_id"]}, {"$set": {"password": ph}})
    await reset_tokens_collection.update_one({"_id": tok}, {"$set": {"used": True}})
    return {"message": "Password changed successfully"}
