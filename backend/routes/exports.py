import csv, io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.database import get_db
from core.dependencies import get_tenant_id
from repositories.activity import ActivityRepository
from repositories.fingerprinted_files import FingerprintedFilesRepository
from repositories.ip_logs import IPLogsRepository
from repositories.nda import NdaAgreementsRepository
from repositories.whatsapp_logs import WhatsAppLogsRepository
from routes.auth import get_current_user

router = APIRouter()


def make_csv(headers: list, rows: list) -> StreamingResponse:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=securedesk_export.csv"}
    )


@router.get("/activity.csv")
async def export_activity(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    is_admin = user.get("role") in ("admin", "manager")
    q = {} if is_admin else {"user_id": user["_id"]}
    cur = ActivityRepository(db, org_id).find_many(q, sort=[("timestamp", -1)]).limit(5000)
    rows = []
    async for d in cur:
        ts = d.get("timestamp", "")
        if hasattr(ts, "isoformat"): ts = ts.isoformat()
        rows.append([
            d.get("user_name", ""),
            d.get("action", ""),
            d.get("filename", ""),
            d.get("risk_level", ""),
            d.get("action_taken", ""),
            str(ts)[:19],
            "; ".join(d.get("reasons", [])[:3]),
        ])
    return make_csv(
        ["Employee", "Action", "Filename", "Risk Level", "Decision", "Timestamp", "Reasons"],
        rows
    )


@router.get("/files.csv")
async def export_files(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    is_admin = user.get("role") in ("admin", "manager")
    q = {} if is_admin else {"owner_id": user["_id"]}
    cur = FingerprintedFilesRepository(db, org_id).find_many(q, sort=[("created_at", -1)]).limit(5000)
    rows = []
    async for d in cur:
        ts = d.get("created_at", "")
        if hasattr(ts, "isoformat"): ts = ts.isoformat()
        rows.append([
            d.get("filename", ""),
            d.get("owner_name", ""),
            d.get("risk_level", ""),
            d.get("action_taken", ""),
            d.get("hash", "")[:16] + "...",
            f"{d.get('file_size', 0) / 1024:.1f} KB",
            str(ts)[:19],
            "; ".join(d.get("reasons", [])[:2]),
        ])
    return make_csv(
        ["Filename", "Owner", "Risk Level", "Decision", "SHA-256 (partial)", "Size", "Scanned At", "Reasons"],
        rows
    )


@router.get("/whatsapp.csv")
async def export_whatsapp(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    is_admin = user.get("role") in ("admin", "manager")
    q = {} if is_admin else {"user_id": user["_id"]}
    cur = WhatsAppLogsRepository(db, org_id).find_many(q, sort=[("timestamp", -1)]).limit(5000)
    rows = []
    async for d in cur:
        ts = d.get("timestamp", "")
        if hasattr(ts, "isoformat"): ts = ts.isoformat()
        rows.append([
            d.get("user_name", ""),
            d.get("filename", ""),
            d.get("recipient", "unknown"),
            d.get("risk_level", ""),
            d.get("action", ""),
            "Yes" if d.get("flagged") else "No",
            str(ts)[:19],
        ])
    return make_csv(
        ["Employee", "File Shared", "Recipient", "Risk Level", "Decision", "Flagged", "Timestamp"],
        rows
    )


@router.get("/nda-signed.csv")
async def export_ndas(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Admin access required")
    cur = NdaAgreementsRepository(db, org_id).find_many({}, sort=[("signed_at", -1)])
    rows = []
    async for d in cur:
        ts = d.get("signed_at", "")
        if hasattr(ts, "isoformat"): ts = ts.isoformat()
        rows.append([
            d.get("user_name", ""),
            d.get("full_name", ""),
            d.get("employee_id", ""),
            d.get("nda_version", "1.0"),
            str(ts)[:19],
            d.get("ip_address", ""),
            d.get("org_name", ""),
        ])
    return make_csv(
        ["Username", "Full Legal Name", "Employee ID", "NDA Version", "Signed At", "IP Address", "Organization"],
        rows
    )


@router.post("/log-ip")
async def log_ip(
    request: Request, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """Log IP address on every login — stored for audit trail."""
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    await IPLogsRepository(db, org_id).insert_one({
        "user_id":   user["_id"],
        "user_name": user["name"],
        "ip":        ip.split(",")[0].strip(),
        "timestamp": datetime.now(timezone.utc),
        "action":    "login",
    })
    return {"logged": True, "ip": ip}


@router.get("/ip-logs")
async def get_ip_logs(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Admin access required")
    cur = IPLogsRepository(db, org_id).find_many({}, sort=[("timestamp", -1)]).limit(200)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"), "isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out
