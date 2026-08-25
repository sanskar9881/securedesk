"""
Evidence Routes — the audit surface for the DPDP evidence chain (Phase 3).

GET  /verify — plain-English verdict + machine-readable problem list, for
               showing an auditor. Staff only: an ordinary employee doesn't
               need to know whether the chain cryptographically holds.
GET  /feed   — org-scoped, paginated, filterable. Employees see only their
               own entries; staff see everyone's.
GET  /stats  — counts by event type, chain length, blocked count, and the
               date logging began — the numbers a compliance dashboard shows.
POST /override-request — Phase 4: records a request to override a BLOCK
               (the Chrome extension's "Request Override" button). Logs the
               request; does NOT itself unblock anything — an override is
               a business-justification record for an admin to review
               later, not an instant bypass. See core/device_auth.py: a
               device token can call this, same as it can call the scan
               endpoints, because it's the extension raising this request
               on the same footing as the scan that produced the BLOCK.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from core.config import get_settings
from core.database import get_db
from core.device_auth import dlp_scan_actor
from core.dependencies import get_tenant_id
from core.events import bus
from core.rbac import is_staff, require_staff
from routes.auth import get_current_user
from services import evidence_service
from services.evidence_service import EVENT_TYPES

router = APIRouter()


@router.get("/verify")
async def verify(
    user=Depends(require_staff),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    return await evidence_service.verify_chain(db, org_id)


@router.get("/feed")
async def feed(
    event_type: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    if event_type and event_type not in EVENT_TYPES:
        raise HTTPException(400, f"Unknown event_type. Valid values: {', '.join(sorted(EVENT_TYPES))}")
    return await evidence_service.get_feed(
        db, org_id,
        user_id=user["_id"], is_staff=is_staff(user),
        event_type=event_type, start=start, end=end,
        page=page, limit=limit,
    )


@router.get("/stats")
async def stats(
    user=Depends(require_staff),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    return await evidence_service.get_stats(db, org_id)


@router.get("/event-types")
async def event_types():
    """The fixed set of event_type values the chain records — lets the
    frontend build a filter dropdown without hardcoding the list twice."""
    return {"event_types": sorted(EVENT_TYPES)}


class OverrideRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_hash: str = ""
    filename: str = ""
    # Free-text business justification the user typed, not anything
    # extracted from the file — a different provenance than the PII-safe
    # regex/vision payloads elsewhere in this chain, but still capped and
    # still never contains raw file content by construction (it's typed by
    # a human explaining themselves, not parsed out of the document).
    reason: str = Field(min_length=1, max_length=500)


@router.post("/override-request")
async def override_request(
    body: OverrideRequestBody,
    user=Depends(dlp_scan_actor),
    db=Depends(get_db),
):
    org_id = user["org_id"]
    if not get_settings().EVIDENCE_ENABLED:
        raise HTTPException(503, "Evidence logging is not enabled on this deployment.")

    results = await bus.publish(
        "override_requested", db, org_id, user_id=user["_id"],
        event_type="override_requested",
        payload={
            "file_hash": body.file_hash[:64],
            "filename": body.filename[:200],
            "reason": body.reason.strip()[:500],
            "auth_method": user.get("_auth", {}).get("method", "session"),
        },
    )
    entry = results[0] if results else None
    return {
        "recorded": entry is not None,
        "evidence_id": entry["_id"] if entry else None,
        "message": "Your override request has been recorded and is visible to your "
                   "administrator. The file was not sent.",
    }
