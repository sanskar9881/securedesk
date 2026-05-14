"""
DLP Analyze Routes
POST /api/dlp/analyze-file   — text-based scan (used by extension)
POST /api/dlp/analyze-upload — file upload scan
GET  /api/dlp/files/logs     — fingerprint log
GET  /api/dlp/activity       — activity log
GET  /api/dlp/stats          — dashboard stats
GET  /api/dlp/alerts         — alerts
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from database import db, fingerprints_collection, activity_collection, alerts_collection
from routes.auth import get_current_user
from services.regex_engine import scan, score
from services.ai_service import classify_file
from services.file_service import extract_text, sha256, save_fingerprint
from services.logger_service import log_event

router = APIRouter()


class TextScanRequest(BaseModel):
    text: str
    filename: str = "unknown.txt"
    use_llm: bool = True


# ── POST /analyze-file ─────────────────────────────────────────────
@router.post("/analyze-file")
async def analyze_text(body: TextScanRequest, user=Depends(get_current_user)):
    findings           = scan(body.text, body.filename)
    risk_level, action, reasons = score(findings)

    llm = {}
    if body.use_llm:
        llm = await classify_file(body.text, body.filename, findings)
        if llm.get("recommended_action") == "BLOCK" and action != "BLOCK":
            action, risk_level = "BLOCK", "HIGH"
            reasons.append(f"AI: {llm.get('sensitivity_reason','')}")

    await log_event(user["_id"], user["name"], "analyze",
                    filename=body.filename, risk_level=risk_level,
                    action_taken=action, reasons=reasons)

    return {"risk_level": risk_level, "recommended_action": action,
            "reasons": reasons or ["No sensitive data detected"],
            "regex_findings": findings, "llm_analysis": llm,
            "filename": body.filename, "scanned_by": user["name"]}


# ── POST /analyze-upload ──────────────────────────────────────────
@router.post("/analyze-upload")
async def analyze_upload(
    file: UploadFile = File(...),
    use_llm: bool    = Form(True),
    user             = Depends(get_current_user),
):
    content   = await file.read()
    filename  = file.filename or "unknown"
    text      = extract_text(content, filename)
    h         = sha256(content)
    findings  = scan(text, filename)
    risk_level, action, reasons = score(findings)

    llm = {}
    if use_llm:
        llm = await classify_file(text, filename, findings)
        if llm.get("recommended_action") == "BLOCK" and action != "BLOCK":
            action, risk_level = "BLOCK", "HIGH"
            reasons.append(f"AI: {llm.get('sensitivity_reason','')}")

    is_dup = await save_fingerprint(h, filename, user["_id"], user["name"],
                                    len(content), risk_level, action, reasons, findings)
    await log_event(user["_id"], user["name"], "upload",
                    filename=filename, file_hash=h,
                    risk_level=risk_level, action_taken=action, reasons=reasons)

    return {"risk_level": risk_level, "recommended_action": action,
            "reasons": reasons or ["No sensitive data detected"],
            "regex_findings": findings, "llm_analysis": llm,
            "file_hash": h, "filename": filename,
            "file_size": len(content), "is_duplicate": is_dup}


# ── GET /files/logs ───────────────────────────────────────────────
@router.get("/files/logs")
async def file_logs(limit: int = 50, user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"owner_id": user["_id"]}
    cur = fingerprints_collection.find(q, sort=[("created_at", -1)]).limit(limit)
    out = []
    async for d in cur:
        for k in ("created_at", "last_accessed"):
            if hasattr(d.get(k), "isoformat"): d[k] = d[k].isoformat()
        out.append(d)
    return out


# ── GET /activity ─────────────────────────────────────────────────
@router.get("/activity")
async def get_activity(limit: int = 100, user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = activity_collection.find(q, sort=[("timestamp", -1)]).limit(limit)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"), "isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


# ── GET /stats ────────────────────────────────────────────────────
@router.get("/stats")
async def stats(user=Depends(get_current_user)):
    is_admin = user.get("role") in ("admin", "manager")
    fq = {} if is_admin else {"owner_id": user["_id"]}
    aq = {} if is_admin else {"user_id": user["_id"]}
    return {
        "total_files":  await fingerprints_collection.count_documents(fq),
        "high_risk":    await fingerprints_collection.count_documents({**fq, "risk_level": "HIGH"}),
        "medium_risk":  await fingerprints_collection.count_documents({**fq, "risk_level": "MEDIUM"}),
        "low_risk":     await fingerprints_collection.count_documents({**fq, "risk_level": "LOW"}),
        "blocked":      await fingerprints_collection.count_documents({**fq, "action_taken": "BLOCK"}),
        "total_events": await activity_collection.count_documents(aq),
        "alerts":       await alerts_collection.count_documents({"read": False}),
    }


# ── GET /alerts ───────────────────────────────────────────────────
@router.get("/alerts")
async def get_alerts(user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = alerts_collection.find(q, sort=[("timestamp", -1)]).limit(20)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"), "isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


@router.post("/alerts/{alert_id}/read")
async def mark_read(alert_id: str, user=Depends(get_current_user)):
    await alerts_collection.update_one({"_id": alert_id}, {"$set": {"read": True}})
    return {"ok": True}
