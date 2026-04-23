import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import users_collection, transactions_collection
from routes.auth import get_current_user, admin_only

router = APIRouter()


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_color: Optional[str] = None
    language: Optional[str] = None


@router.get("/me")
async def get_profile(current_user=Depends(get_current_user)):
    created = current_user.get("created_at", datetime.utcnow())
    created_str = created.isoformat() if hasattr(created, "isoformat") else str(created)
    return {
        "id": current_user["_id"],
        "name": current_user["name"],
        "email": current_user.get("email"),
        "phone": current_user.get("phone"),
        "role": current_user["role"],
        "dob": current_user.get("dob", ""),
        "avatar_color": current_user.get("avatar_color", "#6366f1"),
        "language": current_user.get("language", "en"),
        "created_at": created_str,
    }


@router.put("/me")
async def update_profile(body: ProfileUpdate, current_user=Depends(get_current_user)):
    update_fields = {}
    if body.name:
        update_fields["name"] = body.name
    if body.dob is not None:
        update_fields["dob"] = body.dob
    if body.phone is not None:
        update_fields["phone"] = body.phone
    if body.email is not None:
        update_fields["email"] = body.email
    if body.avatar_color is not None:
        update_fields["avatar_color"] = body.avatar_color
    if body.language is not None:
        update_fields["language"] = body.language

    if update_fields:
        await users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_fields}
        )

    updated = await users_collection.find_one({"_id": current_user["_id"]})
    created = updated.get("created_at", datetime.utcnow())
    created_str = created.isoformat() if hasattr(created, "isoformat") else str(created)
    return {
        "id": updated["_id"],
        "name": updated["name"],
        "email": updated.get("email"),
        "phone": updated.get("phone"),
        "role": updated["role"],
        "dob": updated.get("dob", ""),
        "avatar_color": updated.get("avatar_color", "#6366f1"),
        "language": updated.get("language", "en"),
        "created_at": created_str,
    }


@router.get("/stats/public")
async def public_stats(current_user=Depends(get_current_user)):
    total_users = await users_collection.count_documents({})
    total_transactions = await transactions_collection.count_documents({})
    admin_count = await users_collection.count_documents({"role": "admin"})
    user_count = await users_collection.count_documents({"role": "user"})
    return {
        "total_users": total_users,
        "admin_count": admin_count,
        "user_count": user_count,
        "total_transactions": total_transactions,
    }