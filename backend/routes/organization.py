import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from database import db
from routes.auth import get_current_user

router   = APIRouter()
orgs_col = db["organizations"]
inv_col  = db["invitations"]
users_col= db["users"]


class OrgCreate(BaseModel):
    name: str
    domain: str  # e.g. "acmecorp.com"
    industry: str = "IT"
    size: str = "1-50"

class InviteEmployee(BaseModel):
    email: str
    role: str = "user"  # user | manager


@router.post("/create")
async def create_org(body: OrgCreate, user=Depends(get_current_user)):
    """Create an organization. User becomes the org admin."""
    existing = await orgs_col.find_one({"domain": body.domain})
    if existing:
        raise HTTPException(400, "Organization with this domain already exists")

    org_id = str(uuid.uuid4())
    await orgs_col.insert_one({
        "_id":       org_id,
        "name":      body.name,
        "domain":    body.domain,
        "industry":  body.industry,
        "size":      body.size,
        "owner_id":  user["_id"],
        "owner_name":user["name"],
        "created_at":datetime.now(timezone.utc),
        "plan":      "trial",
        "members":   [{"user_id": user["_id"], "name": user["name"], "role": "admin"}],
    })

    # Link user to this org
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"org_id": org_id, "org_name": body.name}}
    )

    return {"org_id": org_id, "name": body.name, "message": "Organization created successfully"}


@router.get("/me")
async def get_my_org(user=Depends(get_current_user)):
    org_id = user.get("org_id")
    if not org_id:
        return {"org": None, "message": "Not part of any organization"}
    org = await orgs_col.find_one({"_id": org_id})
    if not org:
        return {"org": None}
    org["created_at"] = org["created_at"].isoformat() if hasattr(org.get("created_at"), "isoformat") else ""
    return {"org": org}


@router.post("/invite")
async def invite_employee(body: InviteEmployee, user=Depends(get_current_user)):
    """Send invitation to join the organization."""
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Only admins can invite employees")
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(400, "You must create an organization first")

    inv_id = str(uuid.uuid4())
    await inv_col.insert_one({
        "_id":        inv_id,
        "org_id":     org_id,
        "org_name":   user.get("org_name", ""),
        "invited_by": user["name"],
        "email":      body.email,
        "role":       body.role,
        "status":     "pending",
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "invitation_id":  inv_id,
        "email":          body.email,
        "message":        f"Invitation created for {body.email}",
        "join_link":      f"{__import__('os').getenv('FRONTEND_URL','https://securedesk-beige.vercel.app')}/join/{inv_id}"
    }


@router.get("/members")
async def get_members(user=Depends(get_current_user)):
    org_id = user.get("org_id")
    if not org_id:
        return []
    cursor = users_col.find({"org_id": org_id})
    out    = []
    async for u in cursor:
        out.append({
            "_id":      str(u["_id"]),
            "name":     u.get("name",""),
            "role":     u.get("role","user"),
            "email":    u.get("email",""),
            "created_at": u.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(u.get("created_at"), "isoformat") else "",
        })
    return out


@router.get("/stats")
async def org_stats(user=Depends(get_current_user)):
    from services.ueba_service import get_ueba_dashboard
    org_id = user.get("org_id")
    ueba   = await get_ueba_dashboard(org_id)
    members= await users_col.count_documents({"org_id": org_id} if org_id else {})
    return {"members": members, "ueba": ueba}
