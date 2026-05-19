from datetime import datetime, timedelta
from database import db

activity_col = db["activity_logs"]
ueba_col     = db["ueba_profiles"]
alerts_col   = db["alerts"]


async def get_user_baseline(user_id: str) -> dict:
    """Calculate normal behavior for a user from last 30 days of logs."""
    since  = datetime.utcnow() - timedelta(days=30)
    cursor = activity_col.find({
        "user_id": user_id,
        "timestamp": {"$gte": since}
    })
    hours, actions, count = [], [], 0
    async for doc in cursor:
        ts = doc.get("timestamp")
        if isinstance(ts, datetime):
            hours.append(ts.hour)
        actions.append(doc.get("action", ""))
        count += 1
    if count == 0:
        return {"avg_daily_actions": 10, "typical_hours": list(range(8, 19)),
                "common_actions": ["upload", "analyze"], "total_30d": 0}
    from collections import Counter
    hour_counts  = Counter(hours)
    typical_hours = [h for h, _ in hour_counts.most_common(12)]
    common_actions = list({a for a in actions})
    return {
        "avg_daily_actions": count / 30,
        "typical_hours":     typical_hours,
        "common_actions":    common_actions,
        "total_30d":         count,
    }


async def check_anomalies(user_id: str, user_name: str, action: str,
                           filename: str = "", risk_level: str = "") -> list[str]:
    """
    Compare current activity against baseline.
    Returns list of anomaly descriptions (empty = normal).
    """
    anomalies = []
    baseline  = await get_user_baseline(user_id)
    now       = datetime.utcnow()

    # Anomaly 1 — After-hours activity
    if now.hour < 7 or now.hour > 21:
        anomalies.append(f"After-hours activity at {now.strftime('%H:%M')} — outside normal working hours")

    # Anomaly 2 — High volume in last hour
    one_hour_ago = now - timedelta(hours=1)
    recent_count = await activity_col.count_documents({
        "user_id":   user_id,
        "timestamp": {"$gte": one_hour_ago}
    })
    if recent_count > 30:
        anomalies.append(f"Unusual volume — {recent_count} actions in the last hour")

    # Anomaly 3 — High risk file detected
    if risk_level == "HIGH":
        anomalies.append(f"High-risk file activity: {filename}")

    # Anomaly 4 — Large download burst (50+ files in a day)
    today_start  = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_count  = await activity_col.count_documents({
        "user_id":   user_id,
        "timestamp": {"$gte": today_start}
    })
    if today_count > 50:
        anomalies.append(f"Unusually high activity today — {today_count} actions (normal: ~{int(baseline['avg_daily_actions'])+1}/day)")

    # Store anomalies as alerts
    for anomaly in anomalies:
        await alerts_col.insert_one({
            "_id":       str(__import__("uuid").uuid4()),
            "type":      "UEBA_ANOMALY",
            "user_id":   user_id,
            "user_name": user_name,
            "message":   f"⚠️ Anomaly detected for {user_name}: {anomaly}",
            "detail":    anomaly,
            "action":    action,
            "filename":  filename,
            "read":      False,
            "severity":  "HIGH" if risk_level == "HIGH" else "MEDIUM",
            "timestamp": now,
        })
    return anomalies


async def get_ueba_dashboard(org_id: str = None) -> dict:
    """Get UEBA overview for admin dashboard."""
    q = {}
    if org_id:
        q["org_id"] = org_id
    since  = datetime.utcnow() - timedelta(days=7)
    recent = await activity_col.count_documents({**q, "timestamp": {"$gte": since}})
    alerts = await alerts_col.count_documents({"type": "UEBA_ANOMALY", "read": False})
    high_risk_users = []
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}, "risk_level": "HIGH"}},
        {"$group": {"_id": "$user_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    async for doc in activity_col.aggregate(pipeline):
        high_risk_users.append({"user": doc["_id"], "high_risk_actions": doc["count"]})
    return {
        "week_activities": recent,
        "open_anomaly_alerts": alerts,
        "high_risk_users": high_risk_users,
    }
