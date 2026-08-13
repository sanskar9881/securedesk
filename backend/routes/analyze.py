import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from database import db, fingerprints_collection, activity_collection, alerts_collection
from routes.auth import get_current_user
from services.regex_engine import scan, score
from services.ai_service import classify_file
from services.file_service import extract_text, sha256, save_fingerprint
from services.logger_service import log_event
from services.watermark_service import apply_watermark
from services.ueba_service import check_anomalies
from services.email_alert_service import send_alert_email
from core.uploads import read_validated_upload

router = APIRouter()


class TextScanRequest(BaseModel):
    text: str
    filename: str = "unknown.txt"
    use_llm: bool = True


async def _send_manager_alert(user: dict, filename: str, risk_level: str,
                               reasons: list, action: str):
    """Background task — alert manager via email for HIGH risk events."""
    import os
    from database import db as _db
    manager_email = os.getenv("MANAGER_ALERT_EMAIL", "")
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
async def analyze_text(body: TextScanRequest, user=Depends(get_current_user)):
    findings                 = scan(body.text, body.filename)
    risk_level, action, reasons = score(findings)
    llm = {}
    if body.use_llm:
        llm = await classify_file(body.text, body.filename, findings)
        if llm.get("recommended_action") == "BLOCK" and action != "BLOCK":
            action, risk_level = "BLOCK", "HIGH"
            reasons.append(f"AI: {llm.get('sensitivity_reason','')}")
    anomalies = await check_anomalies(user["_id"], user["name"], "analyze",
                                       body.filename, risk_level)
    await log_event(user["_id"], user["name"], "analyze",
                    filename=body.filename, risk_level=risk_level,
                    action_taken=action, reasons=reasons,
                    extra={"anomalies": anomalies})
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
):
    # Streams with a hard size ceiling, rejects executables, and requires the
    # sniffed magic bytes to agree with the declared extension.
    upload   = await read_validated_upload(file)
    content  = upload.content
    filename = upload.filename
    text     = extract_text(content, filename)
    h        = sha256(content)
    findings = scan(text, filename)
    risk_level, action, reasons = score(findings)

    llm = {}
    if use_llm:
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

    is_dup = await save_fingerprint(h, filename, user["_id"], user["name"],
                                    len(content), risk_level, action, reasons, findings)
    anomalies = await check_anomalies(user["_id"], user["name"], "upload", filename, risk_level)
    await log_event(user["_id"], user["name"], "upload",
                    filename=filename, file_hash=h,
                    risk_level=risk_level, action_taken=action, reasons=reasons,
                    extra={"anomalies": anomalies, "watermarked": watermark})

    # Background email alert for HIGH risk
    if risk_level == "HIGH":
        background_tasks.add_task(_send_manager_alert, user, filename, risk_level, reasons, action)

    return {
        "risk_level": risk_level, "recommended_action": action,
        "reasons": reasons or ["No sensitive data detected"],
        "regex_findings": findings, "llm_analysis": llm,
        "file_hash": h, "filename": filename,
        "file_size": len(content), "is_duplicate": is_dup,
        "watermarked": watermark,
        "anomalies": anomalies,
    }


@router.get("/files/logs")
async def file_logs(limit: int = 50, user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"owner_id": user["_id"]}
    cur = fingerprints_collection.find(q, sort=[("created_at",-1)]).limit(limit)
    out = []
    async for d in cur:
        for k in ("created_at","last_accessed"):
            if hasattr(d.get(k),"isoformat"): d[k] = d[k].isoformat()
        out.append(d)
    return out


@router.get("/activity")
async def get_activity(limit: int = 100, user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = activity_collection.find(q, sort=[("timestamp",-1)]).limit(limit)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"),"isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


@router.get("/stats")
async def stats(user=Depends(get_current_user)):
    is_admin = user.get("role") in ("admin","manager")
    fq = {} if is_admin else {"owner_id": user["_id"]}
    aq = {} if is_admin else {"user_id": user["_id"]}
    return {
        "total_files":  await fingerprints_collection.count_documents(fq),
        "high_risk":    await fingerprints_collection.count_documents({**fq,"risk_level":"HIGH"}),
        "medium_risk":  await fingerprints_collection.count_documents({**fq,"risk_level":"MEDIUM"}),
        "low_risk":     await fingerprints_collection.count_documents({**fq,"risk_level":"LOW"}),
        "blocked":      await fingerprints_collection.count_documents({**fq,"action_taken":"BLOCK"}),
        "total_events": await activity_collection.count_documents(aq),
        "alerts":       await alerts_collection.count_documents({"read":False}),
    }


@router.get("/alerts")
async def get_alerts(user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = alerts_collection.find(q, sort=[("timestamp",-1)]).limit(30)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"),"isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


@router.post("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, user=Depends(get_current_user)):
    """
    Acknowledge an alert. A plain user may only acknowledge alerts raised
    against their own activity; admins and managers may acknowledge any.
    """
    q = {"_id": alert_id}
    if user.get("role") not in ("admin", "manager"):
        q["user_id"] = user["_id"]

    result = await alerts_collection.update_one(
        q, {"$set": {"read": True,
                     "read_by": user["name"],
                     "read_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        from fastapi import HTTPException
        raise HTTPException(404, "That alert no longer exists.")

    await log_event(user["_id"], user["name"], "alert_acknowledged",
                    extra={"alert_id": alert_id})
    return {"acknowledged": True, "alert_id": alert_id}


@router.get("/ueba")
async def ueba_overview(user=Depends(get_current_user)):
    from services.ueba_service import get_ueba_dashboard
    if user.get("role") not in ("admin","manager"):
        from fastapi import HTTPException
        raise HTTPException(403, "Admin access required")
    return await get_ueba_dashboard(user.get("org_id"))
