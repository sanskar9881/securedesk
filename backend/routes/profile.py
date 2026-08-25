import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.dependencies import get_tenant_id
from repositories.transactions import TransactionsRepository
from repositories.users import UsersRepository
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
async def get_profile(
    current_user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    created = current_user.get("created_at", datetime.now(timezone.utc))
    created_str = created.isoformat() if hasattr(created, "isoformat") else str(created)

    response = {
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

    # Add admin-specific stats if user is admin — scoped to their own
    # organisation. These used to be install-wide counts; that leaked one
    # tenant's team size and scan volume to another the moment more than
    # one organisation existed.
    if current_user["role"] == "admin":
        users_repo = UsersRepository(db, org_id)
        tx_repo    = TransactionsRepository(db, org_id)
        total_users = await users_repo.count({})
        admin_count = await users_repo.count({"role": "admin"})
        manager_count = await users_repo.count({"role": "manager"})
        user_count = await users_repo.count({"role": "user"})
        total_transactions = await tx_repo.count({})

        response.update({
            "is_admin": True,
            "admin_stats": {
                "total_users": total_users,
                "admin_count": admin_count,
                "manager_count": manager_count,
                "user_count": user_count,
                "total_transactions": total_transactions,
            }
        })
    else:
        response["is_admin"] = False

    return response


@router.put("/me")
async def update_profile(
    body: ProfileUpdate, current_user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    users_repo = UsersRepository(db, org_id)
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
        await users_repo.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_fields}
        )

    updated = await users_repo.find_one({"_id": current_user["_id"]})
    created = updated.get("created_at", datetime.now(timezone.utc))
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
async def public_stats(
    current_user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """Was install-wide; now scoped to the caller's own organisation for the
    same reason as admin_stats above — these numbers describe a tenant."""
    users_repo = UsersRepository(db, org_id)
    tx_repo    = TransactionsRepository(db, org_id)
    total_users = await users_repo.count({})
    total_transactions = await tx_repo.count({})
    admin_count = await users_repo.count({"role": "admin"})
    user_count = await users_repo.count({"role": "user"})
    return {
        "total_users": total_users,
        "admin_count": admin_count,
        "user_count": user_count,
        "total_transactions": total_transactions,
    }
