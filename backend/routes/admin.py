import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.database import get_db
from core.dependencies import get_tenant_id
from repositories.transactions import TransactionsRepository
from repositories.users import UsersRepository
from core.rbac import (
    ADMIN, MANAGER, USER,
    assert_can_act_on, is_admin, require_admin, require_staff,
    visibility_filter, visible_user_ids,
)

router = APIRouter()

# Transactions record their owner as `sender_id`.
OWNER_FIELD = "sender_id"


@router.get("/stats")
async def get_stats(
    user=Depends(require_staff),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    Posture summary. Admin sees the whole organisation; a manager sees only
    the people who report to them, so the same screen answers "how are WE
    doing" at whichever level the viewer operates.
    """
    tx_repo = TransactionsRepository(db, org_id)
    scope = await visibility_filter(user, OWNER_FIELD)

    def within(extra: dict | None = None) -> dict:
        return {**scope, **(extra or {})}

    total = await tx_repo.count(within())
    suspicious = await tx_repo.count(within({"classification": "suspicious"}))
    legitimate = await tx_repo.count(within({"classification": "legitimate"}))
    high_risk = await tx_repo.count(within({"severity": "high"}))
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent = await tx_repo.count(within({"timestamp": {"$gte": week_ago}}))

    ids = await visible_user_ids(user)
    total_users = await UsersRepository(db, org_id).count({"_id": {"$in": ids}})

    return {
        "total": total,
        "suspicious": suspicious,
        "legitimate": legitimate,
        "high_risk": high_risk,
        "recent_7_days": recent,
        "total_users": total_users,
        "risk_pct": round((suspicious / total * 100) if total > 0 else 0, 1),
        "scope": "organisation" if is_admin(user) else "team",
    }


@router.get("/logs")
async def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    classification: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(require_staff),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    tx_repo = TransactionsRepository(db, org_id)
    query = await visibility_filter(user, OWNER_FIELD)
    if classification:
        query["classification"] = classification
    if severity:
        query["severity"] = severity
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"sender_name": {"$regex": search, "$options": "i"}},
            {"recipient_email": {"$regex": search, "$options": "i"}},
        ]

    total = await tx_repo.count(query)
    skip = (page - 1) * limit
    cursor = tx_repo.find_many(
        query, sort=[("timestamp", -1)]
    ).skip(skip).limit(limit)

    rows = []
    async for t in cursor:
        t["_id"] = str(t["_id"])
        if "timestamp" in t and hasattr(t["timestamp"], "isoformat"):
            t["timestamp"] = t["timestamp"].isoformat()
        rows.append(t)

    return {"total": total, "page": page, "limit": limit, "data": rows}


@router.get("/users")
async def get_users(
    user=Depends(require_staff),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    The people directory. An admin sees every account in the organisation; a
    manager sees only their own reports — they have no view of admins or of
    other managers' teams.
    """
    ids = await visible_user_ids(user)
    cursor = UsersRepository(db, org_id).find_many({"_id": {"$in": ids}}, projection={"password": 0})
    results = []
    async for u in cursor:
        u["_id"] = str(u["_id"])
        if "created_at" in u and hasattr(u["created_at"], "isoformat"):
            u["created_at"] = u["created_at"].isoformat()
        results.append(u)
    return results


@router.get("/devices")
async def list_devices(
    actor=Depends(require_admin),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    Every device token enrolled anywhere in the organisation — the
    "X of Y employees protected" coverage view. Admin-only, unlike
    /api/auth/devices (self-service, one employee's own devices only —
    see routes/device_tokens.py). The raw token is never returned by
    either surface; this one doesn't even return the hash's full form,
    same truncation as the evidence payloads that reference a device_id.
    """
    from services import token_service

    docs = await token_service.list_org_device_tokens(db, org_id)
    return [
        {
            "device_id": d["_id"],
            "user_id": d["user_id"],
            "name": d.get("name", ""),
            "scopes": d.get("scopes", []),
            "created_at": d["created_at"].isoformat() if hasattr(d.get("created_at"), "isoformat") else d.get("created_at"),
            "last_used_at": d["last_used_at"].isoformat() if hasattr(d.get("last_used_at"), "isoformat") else d.get("last_used_at"),
            "expires_at": d["expires_at"].isoformat() if hasattr(d.get("expires_at"), "isoformat") else d.get("expires_at"),
            "revoked": d.get("revoked_at") is not None,
        }
        for d in docs
    ]


@router.delete("/devices/{device_id}")
async def revoke_device(
    device_id: str,
    actor=Depends(require_admin),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    from services import token_service

    ok = await token_service.admin_revoke_device_token(db, org_id=org_id, device_id=device_id)
    if not ok:
        raise HTTPException(404, "That device doesn't exist or was already revoked.")
    return {"revoked": True, "device_id": device_id}


class RoleChange(BaseModel):
    role: str


@router.patch("/users/{user_id}/role")
async def change_role(
    user_id: str, body: RoleChange, actor=Depends(require_admin),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    Grant or revoke a role. Admin-only, deliberately: this is the one operation
    that can manufacture privilege, so managers must never reach it.
    """
    if body.role not in (ADMIN, MANAGER, USER):
        raise HTTPException(400, "Role must be admin, manager, or user.")

    target = await assert_can_act_on(actor, user_id)

    if target["_id"] == actor["_id"] and body.role != ADMIN:
        # Losing the last admin would leave the organisation unmanageable.
        raise HTTPException(400, "You can't remove your own administrator access.")

    await UsersRepository(db, org_id).update_one({"_id": user_id}, {"$set": {"role": body.role}})
    return {"user_id": user_id, "role": body.role}


@router.get("/export")
async def export_csv(
    user=Depends(require_admin),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    Full data export — admin only. A manager's oversight is for coaching their
    team, not for extracting the organisation's dataset.
    """
    query = await visibility_filter(user, OWNER_FIELD)
    cursor = TransactionsRepository(db, org_id).find_many(query, sort=[("timestamp", -1)])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Sender", "Sender Email", "Recipient", "Subject",
        "Filename", "Classification", "Risk Score %", "Severity",
        "Suspicious Keywords", "Timestamp"
    ])

    async for t in cursor:
        ts = t.get("timestamp", "")
        if hasattr(ts, "isoformat"):
            ts = ts.isoformat()
        writer.writerow([
            str(t["_id"]),
            t.get("sender_name", ""),
            t.get("sender_email", ""),
            t.get("recipient_email", ""),
            t.get("subject", ""),
            t.get("filename", ""),
            t.get("classification", ""),
            t.get("risk_score", ""),
            t.get("severity", ""),
            ", ".join(t.get("suspicious_keywords", [])),
            ts,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transaction_logs.csv"}
    )
