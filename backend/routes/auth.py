import uuid
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
import secrets

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from jose import JWTError, jwt

from database import users_collection, reset_tokens_collection
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Pydantic schemas ──────────────────────────────────────────────

class RegisterIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class LoginIn(BaseModel):
    identifier: str
    password: str


class ForgotIn(BaseModel):
    identifier: str


class ResetIn(BaseModel):
    token: str
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────

def hash_pw(pw: str) -> str:
    """Hash password using bcrypt directly (no passlib)."""
    pw_bytes = pw.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(pw_bytes, salt)
    return hashed.decode("utf-8")


def verify_pw(plain: str, hashed: str) -> bool:
    """Verify password using bcrypt directly (no passlib)."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def admin_only(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Routes ────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterIn):
    if not body.email and not body.phone:
        raise HTTPException(status_code=400, detail="Provide email or phone number")

    query = {}
    if body.email:
        query = {"email": body.email}
    elif body.phone:
        query = {"phone": body.phone}

    if await users_collection.find_one(query):
        raise HTTPException(status_code=400, detail="Account already exists with this email/phone")

    count = await users_collection.count_documents({})
    role = "admin" if count == 0 else "user"

    uid = str(uuid.uuid4())
    await users_collection.insert_one({
        "_id": uid,
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "password": hash_pw(body.password),
        "role": role,
        "created_at": datetime.utcnow(),
    })

    token = make_token({"sub": uid, "role": role, "name": body.name})
    return {"access_token": token, "token_type": "bearer", "role": role, "name": body.name}


@router.post("/login")
async def login(body: LoginIn):
    user = await users_collection.find_one({
        "$or": [{"email": body.identifier}, {"phone": body.identifier}]
    })
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")

    token = make_token({"sub": user["_id"], "role": user["role"], "name": user["name"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "name": user["name"]}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    user = await users_collection.find_one({
        "$or": [{"email": body.identifier}, {"phone": body.identifier}]
    })
    if not user:
        return {"message": "If an account exists, a reset token has been generated"}

    reset_token = secrets.token_urlsafe(32)
    await reset_tokens_collection.insert_one({
        "token": reset_token,
        "user_id": user["_id"],
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "used": False,
    })

    # In production: send via email/SMS (SendGrid / Twilio)
    return {
        "message": "Reset token generated (shown here for development only)",
        "reset_token": reset_token,
    }


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    record = await reset_tokens_collection.find_one({
        "token": body.token,
        "used": False,
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    await users_collection.update_one(
        {"_id": record["user_id"]},
        {"$set": {"password": hash_pw(body.new_password)}}
    )
    await reset_tokens_collection.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )
    return {"message": "Password updated successfully"}


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "name": current_user["name"],
        "email": current_user.get("email"),
        "phone": current_user.get("phone"),
        "role": current_user["role"],
    }