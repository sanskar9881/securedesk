"""
AI Copilot Routes
POST /api/ai/query         — natural language query
GET  /api/ai/query/history — past queries
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db, fingerprints_collection, activity_collection
from routes.auth import get_current_user
from services.ai_service import copilot_answer

router = APIRouter()


class QueryIn(BaseModel):
    question: str


def _parse(q: str) -> dict:
    ql = q.lower()
    i  = {"files": False, "activity": False, "risk": None, "days": None, "action": None}
    if any(w in ql for w in ["file","upload","document","scan"]): i["files"]    = True
    if any(w in ql for w in ["activit","log","event","action"]):  i["activity"] = True
    if not i["files"] and not i["activity"]: i["files"] = i["activity"] = True
    if "high" in ql:    i["risk"] = "HIGH"
    elif "medium" in ql:i["risk"] = "MEDIUM"
    elif "low" in ql:   i["risk"] = "LOW"
    if "today" in ql:       i["days"] = 1
    elif "week" in ql:      i["days"] = 7
    elif "month" in ql:     i["days"] = 30
    elif "yesterday" in ql: i["days"] = 2
    if "upload" in ql:    i["action"] = "upload"
    elif "block" in ql:   i["action"] = "block"
    elif "share" in ql:   i["action"] = "share"
    return i


async def _build_context(intent: dict, user: dict) -> str:
    is_admin = user.get("role") in ("admin", "manager")
    parts, tq = [], {}
    if intent["days"]:
        tq = {"$gte": datetime.now(timezone.utc) - timedelta(days=intent["days"])}

    if intent["files"]:
        fq = {} if is_admin else {"owner_id": user["_id"]}
        if intent["risk"]:   fq["risk_level"]   = intent["risk"]
        if tq:               fq["created_at"]   = tq
        cur = fingerprints_collection.find(fq, sort=[("created_at",-1)]).limit(25)
        rows = []
        async for d in cur:
            ts = d.get("created_at","")
            if hasattr(ts,"isoformat"): ts = ts.isoformat()
            rows.append(f"  - {d.get('filename','?')} | owner:{d.get('owner_name','?')} | risk:{d.get('risk_level','?')} | action:{d.get('action_taken','?')} | at:{str(ts)[:16]} | reasons:{'; '.join(d.get('reasons',[])[:2])}")
        parts.append(f"FILE LOGS ({len(rows)} records):\n" + ("\n".join(rows) if rows else "  none"))

    if intent["activity"]:
        aq = {} if is_admin else {"user_id": user["_id"]}
        if intent["risk"]:   aq["risk_level"] = intent["risk"]
        if tq:               aq["timestamp"]  = tq
        if intent["action"]: aq["action"]     = intent["action"]
        cur = activity_collection.find(aq, sort=[("timestamp",-1)]).limit(30)
        rows = []
        async for d in cur:
            ts = d.get("timestamp","")
            if hasattr(ts,"isoformat"): ts = ts.isoformat()
            rows.append(f"  - [{d.get('action','?').upper()}] {d.get('filename','?')} by {d.get('user_name','?')} | risk:{d.get('risk_level','?')} | at:{str(ts)[:16]}")
        parts.append(f"ACTIVITY ({len(rows)} records):\n" + ("\n".join(rows) if rows else "  none"))

    return "\n\n".join(parts)


@router.post("/query")
async def ai_query(body: QueryIn, user=Depends(get_current_user)):
    if len(body.question.strip()) < 3:
        raise HTTPException(400, "Question too short")
    intent  = _parse(body.question)
    context = await _build_context(intent, user)
    answer  = await copilot_answer(body.question, context, user["name"])
    await db["copilot_queries"].insert_one({
        "_id": str(uuid.uuid4()), "user_id": user["_id"], "user_name": user["name"],
        "question": body.question, "answer": answer[:600], "timestamp": datetime.now(timezone.utc),
    })
    return {"question": body.question, "answer": answer, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/query/history")
async def history(user=Depends(get_current_user)):
    q = {} if user.get("role") in ("admin","manager") else {"user_id": user["_id"]}
    cur = db["copilot_queries"].find(q, sort=[("timestamp",-1)]).limit(20)
    out = []
    async for d in cur:
        if hasattr(d.get("timestamp"),"isoformat"): d["timestamp"] = d["timestamp"].isoformat()
        out.append(d)
    return out
