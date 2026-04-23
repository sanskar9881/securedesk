import csv
import io
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from database import transactions_collection, users_collection
from routes.auth import admin_only

router = APIRouter()


@router.get("/stats")
async def get_stats(_=Depends(admin_only)):
    total = await transactions_collection.count_documents({})
    suspicious = await transactions_collection.count_documents({"classification": "suspicious"})
    legitimate = await transactions_collection.count_documents({"classification": "legitimate"})
    high_risk = await transactions_collection.count_documents({"severity": "high"})
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent = await transactions_collection.count_documents({"timestamp": {"$gte": week_ago}})
    total_users = await users_collection.count_documents({})

    return {
        "total": total,
        "suspicious": suspicious,
        "legitimate": legitimate,
        "high_risk": high_risk,
        "recent_7_days": recent,
        "total_users": total_users,
        "risk_pct": round((suspicious / total * 100) if total > 0 else 0, 1),
    }


@router.get("/logs")
async def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    classification: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    _=Depends(admin_only),
):
    query = {}
    if classification:
        query["classification"] = classification
    if severity:
        query["severity"] = severity
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"sender_name": {"$regex": search, "$options": "i"}},
            {"recipient_email": {"$regex": search, "$options": "i"}},
        ]

    total = await transactions_collection.count_documents(query)
    skip = (page - 1) * limit
    cursor = transactions_collection.find(
        query, sort=[("timestamp", -1)]
    ).skip(skip).limit(limit)

    rows = []
    async for t in cursor:
        t["_id"] = str(t["_id"])
        if "timestamp" in t and hasattr(t["timestamp"], "isoformat"):
            t["timestamp"] = t["timestamp"].isoformat()
        rows.append(t)

    return {"total": total, "page": page, "limit": limit, "data": rows}


@router.get("/users")
async def get_users(_=Depends(admin_only)):
    cursor = users_collection.find({}, {"password": 0})
    results = []
    async for u in cursor:
        u["_id"] = str(u["_id"])
        if "created_at" in u and hasattr(u["created_at"], "isoformat"):
            u["created_at"] = u["created_at"].isoformat()
        results.append(u)
    return results


@router.get("/export")
async def export_csv(_=Depends(admin_only)):
    cursor = transactions_collection.find({}, sort=[("timestamp", -1)])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Sender", "Sender Email", "Recipient", "Subject",
        "Filename", "Classification", "Risk Score %", "Severity",
        "Suspicious Keywords", "Timestamp"
    ])

    async for t in cursor:
        ts = t.get("timestamp", "")
        if hasattr(ts, "isoformat"):
            ts = ts.isoformat()
        writer.writerow([
            str(t["_id"]),
            t.get("sender_name", ""),
            t.get("sender_email", ""),
            t.get("recipient_email", ""),
            t.get("subject", ""),
            t.get("filename", ""),
            t.get("classification", ""),
            t.get("risk_score", ""),
            t.get("severity", ""),
            ", ".join(t.get("suspicious_keywords", [])),
            ts,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transaction_logs.csv"}
    )