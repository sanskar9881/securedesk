import re

PATTERNS = {
    "pan_card":    re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b'),
    "aadhaar":     re.compile(r'\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b'),
    "credit_card": re.compile(r'\b(?:\d{4}[\s\-]?){3}\d{4}\b'),
    "ifsc":        re.compile(r'\b[A-Z]{4}0[A-Z0-9]{6}\b'),
    "phone":       re.compile(r'\b[6-9]\d{9}\b'),
    "email":       re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'),
    "api_key":     re.compile(r'\b(sk-|pk-|api[-_]?key[-_]?)[A-Za-z0-9]{16,}\b', re.IGNORECASE),
    "passport":    re.compile(r'\b[A-Z][1-9][0-9]{7}\b'),
    "ip_address":  re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
    "url":         re.compile(r'https?://[^\s<>"]+'),
    "password_kw": re.compile(r'\b(password|passwd|secret|token|api[_\-]?key)\s*[:=]\s*\S+', re.IGNORECASE),
}

SENSITIVE_KEYWORDS = [
    "confidential", "top secret", "do not share", "internal only", "restricted",
    "private key", "secret key", "salary", "payroll", "bank account",
    "credit limit", "cvv", "otp", "classified", "nda", "non-disclosure",
    "personal data", "patient data", "medical record",
]

MALWARE_SIGNATURES = [
    "powershell -enc", "cmd.exe /c", "regsvr32", "mshta.exe",
    "shell_exec(", "eval(base64_decode", "CreateObject(\"WScript",
    "net user /add", "mimikatz", "invoke-expression",
]

RISK_WEIGHTS = {
    "credit_card": 45, "pan_card": 35, "aadhaar": 35,
    "api_key": 30, "password_kw": 30,
    "passport": 25, "ifsc": 20,
    "phone": 10, "email": 5, "url": 3,
    "ip_address": 3, "sensitive_keywords": 8, "malware_signatures": 50,
}


def scan(text: str, filename: str = "") -> dict:
    """Run all patterns against text. Returns findings dict."""
    findings = {}
    for name, pattern in PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            findings[name] = len(matches)

    # Keywords
    kw = [k for k in SENSITIVE_KEYWORDS if k in text.lower()]
    if kw:
        findings["sensitive_keywords"] = kw

    # Malware (only for script-like files)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("ps1", "bat", "cmd", "vbs", "js", "sh", "py", "txt", ""):
        mal = [s for s in MALWARE_SIGNATURES if s.lower() in text.lower()]
        if mal:
            findings["malware_signatures"] = mal

    return findings


HIGH_THRESHOLD = 60
MEDIUM_THRESHOLD = 25


def classify_score(total_score: int) -> tuple[str, str]:
    """The numeric-score -> (risk_level, action) mapping, factored out so
    anything that adjusts total_score after the fact — vision_service's
    escalation being the reason this exists — reclassifies through the
    exact same thresholds regex findings do, rather than a second,
    possibly-drifting copy of 60/25."""
    if total_score >= HIGH_THRESHOLD:
        return "HIGH", "BLOCK"
    elif total_score >= MEDIUM_THRESHOLD:
        return "MEDIUM", "WARN"
    return "LOW", "ALLOW"


def score_detailed(findings: dict) -> tuple[int, str, str, list[str]]:
    """Convert findings to (total_score, risk_level, action, reasons).

    The numeric total_score is exposed (score() below discards it) because
    vision_service needs it: the escalation formula is
    `total_score = max(total_score, total_score + vision.risk_delta)`,
    which only makes sense against the number, not the HIGH/MEDIUM/LOW
    label derived from it.
    """
    total_score = 0
    reasons     = []

    for key, val in findings.items():
        w   = RISK_WEIGHTS.get(key, 5)
        cnt = len(val) if isinstance(val, list) else val
        total_score += w * min(cnt, 3)

        if key == "credit_card":          reasons.append(f"💳 Credit/debit card number(s) found: {cnt}")
        elif key == "pan_card":           reasons.append(f"🪪 PAN card number(s) found: {cnt}")
        elif key == "aadhaar":            reasons.append(f"🆔 Aadhaar number(s) found: {cnt}")
        elif key == "api_key":            reasons.append("🔑 API key or secret token detected")
        elif key == "password_kw":        reasons.append("🔐 Password or credential exposed in text")
        elif key == "malware_signatures": reasons.append(f"🦠 Malware pattern: {val[0] if val else ''}")
        elif key == "sensitive_keywords": reasons.append(f"⚠️ Sensitive keywords: {', '.join(val[:3])}")
        elif key == "phone" and cnt > 3:  reasons.append(f"📱 Bulk phone numbers: {cnt}")
        elif key == "email" and cnt > 5:  reasons.append(f"📧 Bulk email addresses: {cnt}")
        elif key == "ifsc":               reasons.append(f"🏦 Bank IFSC code(s): {cnt}")

    total_score = min(total_score, 100)
    risk_level, action = classify_score(total_score)
    return total_score, risk_level, action, reasons


def score(findings: dict) -> tuple[str, str, list[str]]:
    """Convert findings to risk_level, action, reasons.

    Thin wrapper over score_detailed() kept for every existing caller that
    doesn't need the numeric score — signature unchanged.
    """
    _, risk_level, action, reasons = score_detailed(findings)
    return risk_level, action, reasons
