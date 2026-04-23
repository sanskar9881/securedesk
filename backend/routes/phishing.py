
import re
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database import transactions_collection
from routes.auth import get_current_user
from ml.classifier import classify_transaction, SUSPICIOUS_KEYWORDS

router = APIRouter()

URL_PATTERN = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
URGENCY_WORDS = ["urgent", "immediately", "act now", "limited time", "expire", "suspended", "verify now", "click here", "confirm now"]
SPOOF_INDICATORS = ["no-reply@", "noreply@", "support@", "security@", "alert@", "update@", "notification@"]


class PhishingCheck(BaseModel):
    content: str
    sender: str = ""
    subject: str = ""
    source: str = "manual"  # manual, email, teams, slack


def analyze_phishing(content: str, sender: str, subject: str) -> dict:
    text = f"{subject} {content}".lower()
    sender_lower = sender.lower()

    # URL analysis
    urls = URL_PATTERN.findall(f"{subject} {content}")
    suspicious_urls = []
    for url in urls:
        domain = re.search(r'https?://([^/]+)', url)
        if domain:
            d = domain.group(1)
            # Check for lookalike domains, IP addresses, odd TLDs
            if re.match(r'\d+\.\d+\.\d+\.\d+', d):
                suspicious_urls.append({"url": url, "reason": "IP address instead of domain"})
            elif any(x in d for x in ["paypal", "amazon", "google", "microsoft", "apple", "bank"]):
                suspicious_urls.append({"url": url, "reason": "Possible brand impersonation"})
            elif d.count('.') > 3:
                suspicious_urls.append({"url": url, "reason": "Excessive subdomains"})

    # Keyword analysis
    found_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in text]
    urgency_found = [w for w in URGENCY_WORDS if w in text]
    spoof_sender = any(s in sender_lower for s in SPOOF_INDICATORS)

    # ML classification
    ml_result = classify_transaction(subject, content, "")
    risk_score = ml_result["risk_score"]

    # Adjust risk based on additional signals
    if suspicious_urls:
        risk_score = min(100, risk_score + 15 * len(suspicious_urls))
    if spoof_sender:
        risk_score = min(100, risk_score + 20)
    if len(urgency_found) > 2:
        risk_score = min(100, risk_score + 10)

    risk_score = round(risk_score, 1)

    if risk_score >= 70:
        verdict = "phishing"
        severity = "high"
    elif risk_score >= 40:
        verdict = "suspicious"
        severity = "medium"
    else:
        verdict = "safe"
        severity = "low"

    threats = []
    if suspicious_urls:
        threats.append(f"{len(suspicious_urls)} suspicious URL(s) detected")
    if found_keywords:
        threats.append(f"Suspicious keywords: {', '.join(found_keywords[:5])}")
    if urgency_found:
        threats.append(f"Urgency manipulation: {', '.join(urgency_found[:3])}")
    if spoof_sender:
        threats.append("Sender address appears to be a spoofed/automated account")

    return {
        "verdict": verdict,
        "severity": severity,
        "risk_score": risk_score,
        "suspicious_keywords": found_keywords,
        "suspicious_urls": suspicious_urls,
        "urgency_signals": urgency_found,
        "spoof_sender_detected": spoof_sender,
        "threats": threats,
        "url_count": len(urls),
        "recommendation": (
            "Do NOT click any links. Report to IT security immediately."
            if verdict == "phishing"
            else "Exercise caution. Verify the sender through official channels."
            if verdict == "suspicious"
            else "Content appears safe. Always stay vigilant."
        ),
    }


@router.post("/check")
async def check_phishing(body: PhishingCheck, current_user=Depends(get_current_user)):
    result = analyze_phishing(body.content, body.sender, body.subject)

    # Log to database
    log = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "user_name": current_user["name"],
        "source": body.source,
        "sender": body.sender,
        "subject": body.subject,
        "content_preview": body.content[:200],
        "verdict": result["verdict"],
        "risk_score": result["risk_score"],
        "severity": result["severity"],
        "threats": result["threats"],
        "type": "phishing_check",
        "timestamp": datetime.utcnow(),
    }
    await transactions_collection.insert_one(log)

    return {**result, "check_id": log["_id"]}


@router.get("/history")
async def phishing_history(current_user=Depends(get_current_user)):
    cursor = transactions_collection.find(
        {"user_id": current_user["_id"], "type": "phishing_check"},
        sort=[("timestamp", -1)]
    ).limit(30)
    results = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        if hasattr(r.get("timestamp"), "isoformat"):
            r["timestamp"] = r["timestamp"].isoformat()
        results.append(r)
    return results
