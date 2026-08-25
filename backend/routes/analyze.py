import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel

from core.config import get_settings
from core.database import get_db
from core.dependencies import get_tenant_id
from repositories.activity import ActivityRepository
from repositories.alerts import AlertsRepository
from repositories.fingerprinted_files import FingerprintedFilesRepository
from routes.auth import get_current_user
from services import evidence_service
from services.vision_service import analyze_image
from services.regex_engine import classify_score, scan, score_detailed
from services.ai_service import classify_file
from services.file_service import extract_text, sha256, save_fingerprint
from services.logger_service import log_event
from services.watermark_service import apply_watermark
from services.ueba_service import check_anomalies, get_ueba_dashboard
from services.email_alert_service import send_alert_email
from core.uploads import DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, is_image, read_validated_upload

router = APIRouter()
log = logging.getLogger("securedesk.analyze")

_EVENT_TYPE_BY_ACTION = {"ALLOW": "scan_allowed", "WARN": "scan_warned", "BLOCK": "scan_blocked"}


async def _record_scan_evidence(db, org_id: str, user: dict, action: str, payload: dict) -> None:
    """
    Append a scan decision to the evidence chain. Called synchronously in
    the request path, after the decision is made and before the response
    is returned — this is the blocking=True handler the (future) event bus
    will formalise, but the ordering matters today regardless of whether
    an event bus exists: a scan decision that was never durably logged is
    not the product SecureDesk sells (see services/evidence_service.py).

    payload must already be PII-safe by the time it reaches here — no raw
    file text, no matched PII substrings, only categories/counts/summaries.
    regex_engine.scan() already returns counts rather than matched values,
    and callers below only add hashes, filenames, and reason strings.

    If EVIDENCE_ENABLED is false, this is a no-op with a warning — lets
    a deployment that hasn't configured the signing key yet keep scanning.
    Once enabled, a failure here propagates as a 500 rather than being
    swallowed: silently letting a scan decision go unlogged would be a
    silent failure of the exact guarantee the product sells. There is no
    retry/circuit-breaker around this yet — that's Phase 6 resilience work,
    not built at the time this was wired in.
    """
    settings = get_settings()
    if not settings.EVIDENCE_ENABLED:
        log.warning("evidence chain disabled (EVIDENCE_ENABLED=false) — scan not recorded")
        return
    event_type = _EVENT_TYPE_BY_ACTION.get(action, "scan_warned")
    await evidence_service.append_entry(
        db, org_id, user_id=user["_id"], event_type=event_type, payload=payload,
    )


class TextScanRequest(BaseModel):
    text: str
    filename: str = "unknown.txt"
    use_llm: bool = True


async def _send_manager_alert(user: dict, filename: str, risk_level: str,
                               reasons: list, action: str):
    """Background task — alert manager via email for HIGH risk events."""
    manager_email = get_settings().MANAGER_ALERT_EMAIL
    if not manager_email or risk_level != "HIGH":
        return
    await send_alert_email(
        to_email     = manager_email,
        manager_name = "Security Manager",
        event_type   = "File Upload / Scan",
        employee_name= user.get("name","Unknown"),
        filename     = filename,
        risk_level   = risk_level,
        reasons      = reasons,
        action_taken = action,
    )


@router.post("/analyze-file")
async def analyze_text(
    body: TextScanRequest, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    findings                 = scan(body.text, body.filename)
    risk_level, action, reasons = score(findings)
    llm = {}
    if body.use_llm:
        llm = await classify_file(body.text, body.filename, findings)
        if llm.get("recommended_action") == "BLOCK" and action != "BLOCK":
            action, risk_level = "BLOCK", "HIGH"
            reasons.append(f"AI: {llm.get('sensitivity_reason','')}")
    anomalies = await check_anomalies(db, org_id, user["_id"], user["name"], "analyze",
                                       body.filename, risk_level)
    await log_event(db, org_id, user["_id"], user["name"], "analyze",
                    filename=body.filename, risk_level=risk_level,
                    action_taken=action, reasons=reasons,
                    extra={"anomalies": anomalies})

    # Blocking: lands before the response returns. No raw text — findings
    # already carry counts rather than matched values (see regex_engine.py).
    await _record_scan_evidence(db, org_id, user, action, payload={
        "filename": body.filename, "source": "text_scan",
        "risk_level": risk_level, "action": action, "reasons": reasons,
        "regex_findings": findings,
        "llm_summary": llm.get("sensitivity_reason") if llm else None,
    })

    return {
        "risk_level": risk_level, "recommended_action": action,
        "reasons": reasons or ["No sensitive data detected"],
        "regex_findings": findings, "llm_analysis": llm,
        "filename": body.filename, "anomalies": anomalies,
        "scanned_by": user["name"],
    }


@router.post("/analyze-upload")
async def analyze_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    use_llm: bool    = Form(True),
    watermark: bool  = Form(True),
    user             = Depends(get_current_user),
    org_id: str      = Depends(get_tenant_id),
    db               = Depends(get_db),
):
    # Streams with a hard size ceiling, rejects executables, and requires the
    # sniffed magic bytes to agree with the declared extension. Documents
    # AND images — this is the one upload path with vision_service behind
    # it (routes/files.py's /send stays document-only, see its call site).
    upload   = await read_validated_upload(file, allowed_extensions=DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS)
    content  = upload.content
    filename = upload.filename
    text     = extract_text(content, filename)
    h        = sha256(content)
    findings = scan(text, filename)
    total_score, risk_level, action, reasons = score_detailed(findings)

    llm = {}
    vision: dict | None = None

    if is_image(upload.extension):
        # This is the fix for the fatal gap: extract_text() on a JPEG/PNG
        # falls through to decoding raw image bytes as UTF-8 with errors
        # ignored, which finds nothing — every photographed Aadhaar/PAN
        # card scored LOW regardless of content. Text-based LLM
        # classification is skipped here rather than run pointlessly on
        # that same garbage text; vision_service looks at the actual pixels
        # instead. Escalation-only: total_score can only go up from here.
        result = await analyze_image(content)
        total_score = min(100, max(total_score, total_score + result.risk_delta))
        risk_level, action = classify_score(total_score)
        reasons.extend(result.reasons)
        vision = {
            "document_types": result.document_types,
            "confidence": result.confidence,
            "risk_delta": result.risk_delta,
            "unverified": result.unverified,
            "provider": result.provider,
        }
    elif use_llm:
        llm = await classify_file(text, filename, findings)
        if llm.get("recommended_action") == "BLOCK" and action != "BLOCK":
            action, risk_level = "BLOCK", "HIGH"
            reasons.append(f"AI: {llm.get('sensitivity_reason','')}")

    # Apply watermark if requested
    watermarked_content = content
    org_name = user.get("org_name", "SecureDesk")
    file_id  = h[:12]
    if watermark:
        watermarked_content = apply_watermark(
            content, filename, user["name"], org_name, file_id,
            visible=(risk_level in ("HIGH", "MEDIUM"))
        )

    is_dup = await save_fingerprint(db, org_id, h, filename, user["_id"], user["name"],
                                    len(content), risk_level, action, reasons, findings)
    anomalies = await check_anomalies(db, org_id, user["_id"], user["name"], "upload", filename, risk_level)
    await log_event(db, org_id, user["_id"], user["name"], "upload",
                    filename=filename, file_hash=h,
                    risk_level=risk_level, action_taken=action, reasons=reasons,
                    extra={"anomalies": anomalies, "watermarked": watermark})

    # Blocking: lands before the response returns. file_hash identifies the
    # content without storing it; regex_findings carry counts, never the
    # matched PII values themselves.
    await _record_scan_evidence(db, org_id, user, action, payload={
        "filename": filename, "source": "file_upload",
        "file_hash": h, "file_size": len(content),
        "risk_level": risk_level, "action": action, "reasons": reasons,
        "regex_findings": findings,
        "llm_summary": llm.get("sensitivity_reason") if llm else None,
        "vision_document_types": vision["document_types"] if vision else None,
        "vision_confidence": vision["confidence"] if vision else None,
        "vision_unverified": vision["unverified"] if vision else None,
        "is_duplicate": is_dup, "watermarked": watermark,
    })

    # Background email alert for HIGH risk
    if risk_level == "HIGH":
        background_tasks.add_task(_send_manager_alert, user, filename, risk_level, reasons, action)

    return {
        "risk_level": risk_level, "recommended_action": action,
        "reasons": reasons or ["No sensitive data detected"],
        "regex_findings": findings, "llm_analysis": llm,
        "vision_analysis": vision,
        "file_hash": h, "filename": filename,
        "file_size": len(content), "is_duplicate": is_dup,
        "watermarked": watermark,
        "anomalies": anomalies,
    }


@router.get("/files/logs")
async def file_logs(
    limit: int = 50, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    repo = FingerprintedFilesRepository(db, org_id)
    q = {} if user.get("role") in ("admin","manager") else {"owner_id": user["_id"]}
    cur = repo.find_many(q, sort=[("created_at",-1)]).limit(limit)
    out = []
    async for d in cur:
        for k in ("created_at","last_accessed"):
            if hasattr(d.get(k),"isoformat"): d[k] = d[k].isoformat()
        out.append(d)
    return out


@router.get("/activity")
async def get_activity(
    limit: int = 100, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    repo = ActivityRepository(db, org_id)
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = repo.find_many(q, sort=[("timestamp",-1)]).limit(limit)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"),"isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


@router.get("/stats")
async def stats(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    files_repo    = FingerprintedFilesRepository(db, org_id)
    activity_repo = ActivityRepository(db, org_id)
    alerts_repo   = AlertsRepository(db, org_id)

    is_admin = user.get("role") in ("admin","manager")
    fq = {} if is_admin else {"owner_id": user["_id"]}
    aq = {} if is_admin else {"user_id": user["_id"]}
    return {
        "total_files":  await files_repo.count(fq),
        "high_risk":    await files_repo.count({**fq,"risk_level":"HIGH"}),
        "medium_risk":  await files_repo.count({**fq,"risk_level":"MEDIUM"}),
        "low_risk":     await files_repo.count({**fq,"risk_level":"LOW"}),
        "blocked":      await files_repo.count({**fq,"action_taken":"BLOCK"}),
        "total_events": await activity_repo.count(aq),
        "alerts":       await alerts_repo.count({"read":False}),
    }


@router.get("/alerts")
async def get_alerts(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    repo = AlertsRepository(db, org_id)
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = repo.find_many(q, sort=[("timestamp",-1)]).limit(30)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"),"isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


@router.post("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    """
    Acknowledge an alert. A plain user may only acknowledge alerts raised
    against their own activity; admins and managers may acknowledge any
    alert within their own organisation.
    """
    repo = AlertsRepository(db, org_id)
    q = {"_id": alert_id}
    if user.get("role") not in ("admin", "manager"):
        q["user_id"] = user["_id"]

    result = await repo.update_one(
        q, {"$set": {"read": True,
                     "read_by": user["name"],
                     "read_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "That alert no longer exists.")

    await log_event(db, org_id, user["_id"], user["name"], "alert_acknowledged",
                    extra={"alert_id": alert_id})
    return {"acknowledged": True, "alert_id": alert_id}


@router.get("/ueba")
async def ueba_overview(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    if user.get("role") not in ("admin","manager"):
        raise HTTPException(403, "Admin access required")
    return await get_ueba_dashboard(db, org_id)
