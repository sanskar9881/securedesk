import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database import db
from routes.auth import get_current_user

router  = APIRouter()
wa_col  = db["whatsapp_logs"]
act_col = db["activity_logs"]


class WAScanRequest(BaseModel):
    filename:     str
    file_size_kb: float = 0
    recipient:    str = "unknown"   # phone or group name if detectable
    content_text: str = ""          # extracted text if readable
    page_url:     str = "web.whatsapp.com"


@router.post("/scan")
async def scan_whatsapp_share(body: WAScanRequest, user=Depends(get_current_user)):
    """Called by Chrome extension when file upload detected on WhatsApp Web."""
    from services.regex_engine import scan, score as risk_score
    from services.ai_service import classify_file

    findings = scan(body.content_text, body.filename) if body.content_text else {}
    risk_level, action, reasons = risk_score(findings)

    llm = {}
    if body.content_text and len(body.content_text) > 10:
        llm = await classify_file(body.content_text, body.filename, findings)
        if llm.get("recommended_action") == "BLOCK" and action != "BLOCK":
            action, risk_level = "BLOCK", "HIGH"
            reasons.append(f"AI: {llm.get('sensitivity_reason','')}")

    log_id = str(uuid.uuid4())
    log_doc = {
        "_id":        log_id,
        "user_id":    user["_id"],
        "user_name":  user["name"],
        "filename":   body.filename,
        "file_size":  body.file_size_kb,
        "recipient":  body.recipient,
        "platform":   "WhatsApp Web",
        "risk_level": risk_level,
        "action":     action,
        "reasons":    reasons,
        "findings":   findings,
        "llm":        llm,
        "timestamp":  datetime.now(timezone.utc),
        "flagged":    risk_level in ("HIGH","MEDIUM"),
    }
    await wa_col.insert_one(log_doc)

    # Also log to main activity
    await act_col.insert_one({
        "_id":          str(uuid.uuid4()),
        "user_id":      user["_id"],
        "user_name":    user["name"],
        "action":       "whatsapp_share",
        "filename":     body.filename,
        "risk_level":   risk_level,
        "action_taken": action,
        "reasons":      reasons,
        "platform":     "WhatsApp Web",
        "timestamp":    datetime.now(timezone.utc),
    })

    return {
        "risk_level":         risk_level,
        "recommended_action": action,
        "reasons":            reasons or ["No sensitive data found"],
        "regex_findings":     findings,
        "llm_analysis":       llm,
        "log_id":             log_id,
        "flagged":            risk_level in ("HIGH","MEDIUM"),
        "message":            "⚠️ Sensitive data detected - do not share!" if risk_level == "HIGH"
                              else "Review before sharing" if risk_level == "MEDIUM"
                              else "File appears safe",
    }


@router.get("/logs")
async def whatsapp_logs(limit: int = 100, user=Depends(get_current_user)):
    is_admin = user.get("role") in ("admin","manager")
    q = {} if is_admin else {"user_id": user["_id"]}
    cur = wa_col.find(q, sort=[("timestamp",-1)]).limit(limit)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"),"isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out


@router.get("/stats")
async def whatsapp_stats(user=Depends(get_current_user)):
    is_admin = user.get("role") in ("admin","manager")
    q = {} if is_admin else {"user_id": user["_id"]}
    total   = await wa_col.count_documents(q)
    flagged = await wa_col.count_documents({**q, "flagged": True})
    high    = await wa_col.count_documents({**q, "risk_level": "HIGH"})
    return {"total_shares": total, "flagged": flagged, "high_risk": high}
