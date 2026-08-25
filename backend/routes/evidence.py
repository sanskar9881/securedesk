"""
Evidence Routes — the audit surface for the DPDP evidence chain (Phase 3).

GET /verify — plain-English verdict + machine-readable problem list, for
              showing an auditor. Staff only: an ordinary employee doesn't
              need to know whether the chain cryptographically holds.
GET /feed   — org-scoped, paginated, filterable. Employees see only their
              own entries; staff see everyone's.
GET /stats  — counts by event type, chain length, blocked count, and the
              date logging began — the numbers a compliance dashboard shows.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.database import get_db
from core.dependencies import get_tenant_id
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
