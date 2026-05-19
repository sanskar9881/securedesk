import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from database import db
from routes.auth import get_current_user

router   = APIRouter()
notif_col = db["notifications"]
alerts_col = db["alerts"]


@router.get("/")
async def get_notifications(user=Depends(get_current_user)):
    """
    Returns unread notifications for current user.
    Merges from both notifications and alerts collections.
    Frontend polls this every 30 seconds.
    """
    is_admin = user.get("role") in ("admin", "manager")

    # From alerts collection
    q_alerts = {} if is_admin else {"user_id": user["_id"]}
    q_alerts["read"] = False
    cur = alerts_col.find(q_alerts, sort=[("timestamp", -1)]).limit(20)
    notifs = []
    async for d in cur:
        ts = d.get("timestamp", "")
        if hasattr(ts, "isoformat"): ts = ts.isoformat()
        notifs.append({
            "_id":       str(d["_id"]),
            "type":      d.get("type", "ALERT"),
            "message":   d.get("message", ""),
            "severity":  d.get("severity", "MEDIUM"),
            "user_name": d.get("user_name", ""),
            "filename":  d.get("filename", ""),
            "read":      False,
            "timestamp": ts,
            "source":    "alert",
        })

    # From notifications collection
    q_notif = {} if is_admin else {"user_id": user["_id"]}
    q_notif["read"] = False
    cur2 = notif_col.find(q_notif, sort=[("timestamp", -1)]).limit(20)
    async for d in cur2:
        ts = d.get("timestamp", "")
        if hasattr(ts, "isoformat"): ts = ts.isoformat()
        notifs.append({
            "_id":       str(d["_id"]),
            "type":      d.get("type", "INFO"),
            "message":   d.get("message", ""),
            "severity":  d.get("severity", "LOW"),
            "user_name": d.get("user_name", ""),
            "read":      False,
            "timestamp": ts,
            "source":    "notification",
        })

    # Sort by timestamp descending
    notifs.sort(key=lambda x: x["timestamp"], reverse=True)
    return notifs[:20]


@router.get("/count")
async def notification_count(user=Depends(get_current_user)):
    is_admin = user.get("role") in ("admin", "manager")
    q = {} if is_admin else {"user_id": user["_id"]}
    count = await alerts_col.count_documents({**q, "read": False})
    count += await notif_col.count_documents({**q, "read": False})
    return {"count": count}


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user)):
    await alerts_col.update_one({"_id": notif_id}, {"$set": {"read": True}})
    await notif_col.update_one({"_id": notif_id}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    is_admin = user.get("role") in ("admin", "manager")
    q = {} if is_admin else {"user_id": user["_id"]}
    await alerts_col.update_many({**q, "read": False}, {"$set": {"read": True}})
    await notif_col.update_many({**q, "read": False}, {"$set": {"read": True}})
    return {"ok": True}
