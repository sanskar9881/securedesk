import os
import re
import pickle
import numpy as np

SUSPICIOUS_KEYWORDS = [
    "password", "passwd", "credentials", "urgent", "wire transfer",
    "bank account", "confidential", "secret", "private key", "api key",
    "token", "verify account", "suspended", "limited time", "act now",
    "congratulations", "lottery", "prize", "winner", "free money",
    "click here", "invoice payment", "account details", "otp", "pin",
    "social security", "credit card", "cvv", "phishing", "malware"
]

HIGH_RISK_EXT = {".exe", ".bat", ".sh", ".ps1", ".vbs", ".jar", ".cmd", ".msi"}
MEDIUM_RISK_EXT = {".zip", ".rar", ".7z", ".tar", ".gz"}
DOC_EXT = {".pdf", ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".csv"}

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

TRAINING_DATA = [
    # --- LEGITIMATE ---
    {"subject": "Q3 Report", "body": "Please find attached the quarterly report for your review. Let me know if you have questions.", "filename": "report.pdf", "label": "legitimate"},
    {"subject": "Meeting notes", "body": "Hi team, attached are the notes from today's standup. Please review and share your feedback.", "filename": "notes.docx", "label": "legitimate"},
    {"subject": "Project update", "body": "Here is the latest update on Project X. Please review the attached document.", "filename": "update.pptx", "label": "legitimate"},
    {"subject": "Design files", "body": "Sharing the updated design mockups for client review. Please check the attached files.", "filename": "design.pdf", "label": "legitimate"},
    {"subject": "Budget review", "body": "Please find the budget review document attached for your approval.", "filename": "budget.xlsx", "label": "legitimate"},
    {"subject": "Team presentation", "body": "Sharing the presentation for tomorrow's board meeting. Please review.", "filename": "slides.pptx", "label": "legitimate"},
    {"subject": "Training material", "body": "Please find the onboarding training materials attached for new joiners.", "filename": "training.pdf", "label": "legitimate"},
    {"subject": "Research paper", "body": "Sharing the research paper we discussed last week. It is attached here.", "filename": "research.pdf", "label": "legitimate"},
    {"subject": "Code review notes", "body": "Here are my comments on the pull request. Please see the attached notes.", "filename": "review.txt", "label": "legitimate"},
    {"subject": "Client proposal", "body": "Sharing the proposal document for the new client. Please review before the meeting.", "filename": "proposal.docx", "label": "legitimate"},
    {"subject": "HR policy update", "body": "Please find the updated HR policies for this quarter. Kindly acknowledge receipt.", "filename": "policy.pdf", "label": "legitimate"},
    {"subject": "Roadmap Q4", "body": "Sharing the updated product roadmap for Q4 planning discussion.", "filename": "roadmap.xlsx", "label": "legitimate"},
    {"subject": "Sales data", "body": "Attaching the monthly sales data for your review and reporting.", "filename": "sales.csv", "label": "legitimate"},
    {"subject": "Contract draft", "body": "Please review the attached contract draft and share your comments by Friday.", "filename": "contract.docx", "label": "legitimate"},
    {"subject": "Compliance checklist", "body": "The compliance checklist for this quarter is attached. Please complete it.", "filename": "checklist.xlsx", "label": "legitimate"},
    {"subject": "User research findings", "body": "Sharing findings from the recent user research sessions. Attached is the report.", "filename": "findings.pdf", "label": "legitimate"},
    {"subject": "Architecture diagram", "body": "Updated system architecture diagram is attached. Please review with the team.", "filename": "arch.pdf", "label": "legitimate"},
    {"subject": "Weekly report", "body": "Please find the weekly progress report for your review. All tasks on track.", "filename": "weekly.pdf", "label": "legitimate"},
    {"subject": "Audit document", "body": "Attaching the internal audit document for your records and review.", "filename": "audit.pdf", "label": "legitimate"},
    {"subject": "Deployment checklist", "body": "Sharing the deployment checklist for the upcoming release. Please verify.", "filename": "deploy.xlsx", "label": "legitimate"},
    {"subject": "Invoice from vendor", "body": "Please find attached the invoice from our vendor for this month's services.", "filename": "invoice.pdf", "label": "legitimate"},
    {"subject": "Onboarding documents", "body": "Welcome to the team! Please find your onboarding documents attached.", "filename": "onboarding.pdf", "label": "legitimate"},
    {"subject": "Security audit report", "body": "The quarterly security audit report is attached for management review.", "filename": "secaudit.pdf", "label": "legitimate"},
    {"subject": "Annual report", "body": "Please find our annual performance report attached for stakeholder distribution.", "filename": "annual.pdf", "label": "legitimate"},
    {"subject": "Meeting agenda", "body": "Sharing the agenda for next week's all-hands meeting. Please come prepared.", "filename": "agenda.docx", "label": "legitimate"},
    # --- SUSPICIOUS ---
    {"subject": "URGENT: Account suspended", "body": "Your account has been suspended. Verify your credentials immediately or lose access. Click here now.", "filename": "", "label": "suspicious"},
    {"subject": "Confidential wire transfer needed", "body": "This is confidential. Please process a wire transfer to the following bank account immediately. Do not tell anyone.", "filename": "", "label": "suspicious"},
    {"subject": "Prize winner congratulations", "body": "Congratulations you are the lottery winner! Claim your free money prize now. Limited time offer act now.", "filename": "", "label": "suspicious"},
    {"subject": "Password reset required immediately", "body": "Your password has been compromised. Provide your credentials and otp immediately to verify account.", "filename": "", "label": "suspicious"},
    {"subject": "Urgent secret project", "body": "This is a secret and confidential project. Share your api key and private key immediately. Urgent.", "filename": "update.exe", "label": "suspicious"},
    {"subject": "Act now limited time offer", "body": "Limited time offer! Click here for free money. Congratulations winner act now before suspended.", "filename": "", "label": "suspicious"},
    {"subject": "Verify account now or lose access", "body": "Your account will be suspended. Verify account now with your password and pin. Urgent action needed.", "filename": "", "label": "suspicious"},
    {"subject": "Invoice payment urgent please process", "body": "URGENT: Process this invoice payment to bank account immediately. Confidential wire transfer required.", "filename": "invoice.exe", "label": "suspicious"},
    {"subject": "Confidential credentials sharing", "body": "Sending you the credentials and private key for the secret system. Please keep confidential.", "filename": "", "label": "suspicious"},
    {"subject": "Bank account details for payment", "body": "Please find my bank account details and credit card cvv for the urgent payment processing.", "filename": "", "label": "suspicious"},
    {"subject": "System update required urgent now", "body": "Your system requires an urgent update. Download and run the attached file immediately or account suspended.", "filename": "system_update.exe", "label": "suspicious"},
    {"subject": "Lottery winner selected", "body": "Dear winner, you have been selected for a lottery prize. Claim free money now. Limited time act now.", "filename": "", "label": "suspicious"},
    {"subject": "CEO urgent wire transfer request", "body": "This is urgent and confidential from CEO. Process wire transfer to this bank account now. Secret.", "filename": "", "label": "suspicious"},
    {"subject": "API key sharing required now", "body": "Please share your api key and token immediately. Urgent confidential request do not delay.", "filename": "", "label": "suspicious"},
    {"subject": "Free money opportunity act fast", "body": "Congratulations you have won free money. Click here immediately. Limited time offer winner.", "filename": "", "label": "suspicious"},
    {"subject": "Security alert verify pin immediately", "body": "ALERT: Suspicious activity. Verify your pin and password now or your account will be suspended.", "filename": "", "label": "suspicious"},
    {"subject": "Malware removal tool urgent", "body": "Your computer has malware. Download and run this tool immediately. Urgent click here now.", "filename": "malware_fix.bat", "label": "suspicious"},
    {"subject": "CVV card details verification", "body": "Please provide your credit card cvv and social security details to verify your account immediately.", "filename": "", "label": "suspicious"},
    {"subject": "Social security number update required", "body": "Your social security number needs urgent verification. Provide details or account suspended.", "filename": "", "label": "suspicious"},
    {"subject": "Phishing test confidential", "body": "This is a secret phishing test. Click here and provide your credentials password and otp now.", "filename": "test.vbs", "label": "suspicious"},
    {"subject": "Urgent: Confirm your token now", "body": "Your token and credentials have expired. Click here to verify account immediately or lose access.", "filename": "", "label": "suspicious"},
    {"subject": "Prize claim required today", "body": "Congratulations lottery winner! Limited time to claim free money prize. Act now click here.", "filename": "", "label": "suspicious"},
    {"subject": "Confidential project funds transfer", "body": "Wire transfer required for confidential project. Send bank account details and credentials urgent.", "filename": "", "label": "suspicious"},
    {"subject": "Account verification urgent action", "body": "URGENT: Verify account now or suspended. Provide password otp and pin immediately to avoid loss.", "filename": "", "label": "suspicious"},
    {"subject": "Malicious software removal now", "body": "Malware detected on your system. Run attached executable immediately. Urgent click here act now.", "filename": "cleaner.cmd", "label": "suspicious"},
]


def get_extension_risk(filename: str) -> int:
    if not filename:
        return 0
    ext = os.path.splitext(filename.lower())[1]
    if ext in HIGH_RISK_EXT:
        return 3
    elif ext in MEDIUM_RISK_EXT:
        return 2
    elif ext in DOC_EXT:
        return 1
    return 0


def count_suspicious_keywords(text: str) -> int:
    text_lower = text.lower()
    return sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in text_lower)


def get_suspicious_keywords_found(text: str) -> list:
    text_lower = text.lower()
    return [kw for kw in SUSPICIOUS_KEYWORDS if kw in text_lower]


def train_and_save():
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.ensemble import RandomForestClassifier
    import numpy as np

    records = []
    labels = []

    for d in TRAINING_DATA:
        text = f"{d['subject']} {d['body']}"
        records.append({
            "text": text,
            "suspicious_count": count_suspicious_keywords(text),
            "ext_risk": get_extension_risk(d["filename"]),
            "has_url": int(bool(re.search(r"http[s]?://", text))),
            "text_len": min(len(text) / 500, 1.0),
        })
        labels.append(d["label"])

    texts = [r["text"] for r in records]
    extra = np.array([
        [r["suspicious_count"], r["ext_risk"], r["has_url"], r["text_len"]]
        for r in records
    ])

    tfidf = TfidfVectorizer(max_features=200, ngram_range=(1, 2), min_df=1)
    tfidf_features = tfidf.fit_transform(texts).toarray()

    X = np.hstack([tfidf_features, extra])

    clf = RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
    clf.fit(X, labels)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"tfidf": tfidf, "clf": clf}, f)

    print(f"Model trained and saved to {MODEL_PATH}")
    return tfidf, clf


def load_model():
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            obj = pickle.load(f)
        return obj["tfidf"], obj["clf"]
    return train_and_save()


_tfidf = None
_clf = None


def _get_model():
    global _tfidf, _clf
    if _tfidf is None:
        _tfidf, _clf = load_model()
    return _tfidf, _clf


def classify_transaction(subject: str, body: str, filename: str) -> dict:
    tfidf, clf = _get_model()

    text = f"{subject} {body}"
    suspicious_count = count_suspicious_keywords(text)
    ext_risk = get_extension_risk(filename)
    has_url = int(bool(re.search(r"http[s]?://", text)))
    text_len = min(len(text) / 500, 1.0)

    tfidf_feat = tfidf.transform([text]).toarray()
    extra_feat = np.array([[suspicious_count, ext_risk, has_url, text_len]])

    X = np.hstack([tfidf_feat, extra_feat])

    prediction = clf.predict(X)[0]
    proba = clf.predict_proba(X)[0]
    classes = list(clf.classes_)
    susp_idx = classes.index("suspicious")
    risk_score = round(float(proba[susp_idx]) * 100, 1)

    if risk_score >= 70:
        severity = "high"
    elif risk_score >= 35:
        severity = "medium"
    else:
        severity = "low"

    return {
        "classification": prediction,
        "risk_score": risk_score,
        "severity": severity,
        "suspicious_keywords": get_suspicious_keywords_found(text),
    }