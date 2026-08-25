"""
Device token management — issuance, listing, revocation.

A device token lets unattended software (the Chrome extension) call
specific scanning routes on a user's behalf without holding that user's
password or a renewable login session. See services/token_service.py for
what a token can and can't do, and core/device_auth.py for how a route
opts in to accepting one.

Every route here requires a full human session (get_current_user) —
minting or revoking a device token is itself an account-management action;
a device token can never manage device tokens, including itself.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from core.database import get_db
from core.dependencies import get_tenant_id
from routes.auth import get_current_user
from services import token_service

router = APIRouter()


class CreateDeviceTokenBody(BaseModel):
    # Closed shape, same discipline as RegisterBody — a future privileged
    # field can't be smuggled in by a stale or malicious client.
    model_config = ConfigDict(extra="forbid")

    name: str
    scopes: list[str] | None = None


def _public(doc: dict) -> dict:
    """Never the hash, never the raw token — only what the owner needs to
    recognise and manage the device. device_id IS the token hash (see
    repositories/device_tokens.py); it's one-way, so exposing it here
    creates no way to reconstruct the raw credential."""
    return {
        "device_id":    doc["_id"],
        "name":         doc["name"],
        "scopes":       doc["scopes"],
        "created_at":   doc["created_at"].isoformat(),
        "last_used_at": doc["last_used_at"].isoformat() if doc.get("last_used_at") else None,
        "expires_at":   doc["expires_at"].isoformat(),
        "revoked":      doc.get("revoked_at") is not None,
    }


@router.post("")
async def create_device_token(
    body: CreateDeviceTokenBody,
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id),
    db=Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, 'Name your device (e.g. "Work Chrome — Priya").')

    try:
        raw, doc = await token_service.create_device_token(
            db, user_id=user["_id"], org_id=org_id, name=name, scopes=body.scopes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {
        # Shown exactly once, here. It cannot be retrieved again — only
        # revoked and reissued. Paste it into the extension now.
        "device_token": raw,
        **_public(doc),
    }


@router.get("")
async def list_device_tokens(user=Depends(get_current_user), db=Depends(get_db)):
    docs = await token_service.list_device_tokens(db, user["_id"])
    return [_public(d) for d in docs]


@router.delete("/{device_id}")
async def revoke_device_token(
    device_id: str,
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id),
    db=Depends(get_db),
):
    ok = await token_service.revoke_device_token(
        db, user_id=user["_id"], org_id=org_id, device_id=device_id,
    )
    if not ok:
        raise HTTPException(404, "That device token doesn't exist or was already revoked.")
    return {"revoked": True, "device_id": device_id}
