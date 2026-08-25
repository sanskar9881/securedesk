import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from core.database import get_db
from core.dependencies import get_tenant_id
from repositories.invitations import InvitationsRepository
from repositories.organizations import OrganizationsRepository
from repositories.users import UsersRepository
from routes.auth import get_current_user

router = APIRouter()


class OrgCreate(BaseModel):
    name: str
    domain: str  # e.g. "acmecorp.com"
    industry: str = "IT"
    size: str = "1-50"

class InviteEmployee(BaseModel):
    email: str
    role: str = "user"  # user | manager


@router.post("/create")
async def create_org(
    body: OrgCreate, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    Set up the caller's organisation profile.

    Every account already owns a personal organisation the moment it
    authenticates (see routes/auth.py:ensure_personal_org) — org_id is
    mandatory, never assigned here for the first time. This endpoint used
    to unconditionally insert a brand-new organisation and reassign the
    caller's org_id to it, which silently orphaned whatever they were
    linked to before (any teammates who had joined that org lost their
    admin without anyone deciding that). It now updates the org the caller
    already has instead of ever creating a second one for the same person.
    """
    orgs_repo = OrganizationsRepository(db)

    if await orgs_repo.domain_taken_by_another(body.domain, org_id):
        raise HTTPException(400, "Organization with this domain already exists")

    await orgs_repo.update_profile(
        org_id, name=body.name, domain=body.domain,
        industry=body.industry, size=body.size,
    )
    await UsersRepository(db, org_id).update_one(
        {"_id": user["_id"]}, {"$set": {"org_name": body.name}}
    )

    return {"org_id": org_id, "name": body.name, "message": "Organization profile saved"}


@router.get("/me")
async def get_my_org(
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    org = await OrganizationsRepository(db).get(org_id)
    if not org:
        return {"org": None}
    org["created_at"] = org["created_at"].isoformat() if hasattr(org.get("created_at"), "isoformat") else ""
    return {"org": org}


@router.post("/invite")
async def invite_employee(
    body: InviteEmployee, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """Send invitation to join the organization."""
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Only admins can invite employees")

    inv_id = str(uuid.uuid4())
    await InvitationsRepository(db, org_id).insert_one({
        "_id":        inv_id,
        "org_name":   user.get("org_name", ""),
        "invited_by": user["name"],
        "email":      body.email,
        "role":       body.role,
        "status":     "pending",
        "created_at": datetime.now(timezone.utc),
    })

    from core.config import get_settings
    frontend_url = get_settings().FRONTEND_URL or "https://securedesk-beige.vercel.app"
    return {
        "invitation_id":  inv_id,
        "email":          body.email,
        "message":        f"Invitation created for {body.email}",
        "join_link":      f"{frontend_url}/join/{inv_id}"
    }


@router.get("/members")
async def get_members(
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    cursor = UsersRepository(db, org_id).find_many({})
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
async def org_stats(
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    from services.ueba_service import get_ueba_dashboard
    ueba    = await get_ueba_dashboard(db, org_id)
    members = await UsersRepository(db, org_id).count({})
    return {"members": members, "ueba": ueba}
