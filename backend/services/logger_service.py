import uuid
from datetime import datetime
from database import activity_collection, alerts_collection


async def log_event(
    user_id: str,
    user_name: str,
    action: str,          # upload | share | download | analyze | login | block
    filename: str = "",
    file_hash: str = "",
    risk_level: str = "",
    action_taken: str = "",
    reasons: list = None,
    extra: dict = None,
):
    doc = {
        "_id":          str(uuid.uuid4()),
        "user_id":      user_id,
        "user_name":    user_name,
        "action":       action,
        "filename":     filename,
        "file_hash":    file_hash,
        "risk_level":   risk_level,
        "action_taken": action_taken,
        "reasons":      reasons or [],
        "timestamp":    datetime.utcnow(),
        **(extra or {}),
    }
    await activity_collection.insert_one(doc)

    # Auto-create alert for HIGH risk
    if risk_level == "HIGH":
        await alerts_collection.insert_one({
            "_id":       str(uuid.uuid4()),
            "user_id":   user_id,
            "user_name": user_name,
            "type":      "HIGH_RISK_FILE",
            "message":   f"High-risk {action} by {user_name}: {filename or 'unknown file'}",
            "filename":  filename,
            "read":      False,
            "timestamp": datetime.utcnow(),
        })

    return doc["_id"]
