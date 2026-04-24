import os
import re
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db
from routes.auth import get_current_user

router = APIRouter()
chat_collection = db["chats"]

SYSTEM_PROMPT = """You are SecureDesk AI — an expert cybersecurity assistant built into SecureDesk, a corporate Data Loss Prevention (DLP) platform created by Sanskar Hadole.

You are deeply knowledgeable about:
- Phishing detection, email security, social engineering attacks
- Corporate data loss prevention (DLP) strategies
- File security, malware analysis, ransomware prevention
- Indian data laws: DPDP Act 2023, IT Act 2000
- International compliance: GDPR, ISO 27001, SOC2, PCI-DSS
- Sensitive data types: PAN cards, Aadhaar, credit cards, IFSC codes
- Password security, MFA, zero-trust architecture
- Incident response and threat intelligence
- SecureDesk platform features

SecureDesk platform features:
- /share → Upload files, AI scans for PAN/Aadhaar/malware, gives 0-100% risk score
- /phishing → Paste any email/message for instant threat analysis
- /history → Complete audit trail of all file transactions
- /admin → System dashboard with analytics (admin only)
- /profile → User profile and settings

Be helpful, professional, and concise. Use markdown formatting. Use 🔴 high risk, 🟡 medium, 🟢 safe indicators.
Built with love from Sanskar Hadole."""


class MessageIn(BaseModel):
    message: str


class ConversationCreate(BaseModel):
    title: str = "New Conversation"


def has_word(text: str, *words) -> bool:
    """Check for whole-word matches only — prevents 'hi' matching 'phishing'."""
    for word in words:
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def has_phrase(text: str, *phrases) -> bool:
    """Check if any phrase exists in text (substring, case-insensitive)."""
    for phrase in phrases:
        if phrase.lower() in text.lower():
            return True
    return False


def smart_response(message: str, name: str) -> str:
    """Rich domain-specific responses — always gives a real answer."""
    msg = message.strip()
    msg_lower = msg.lower()

    # ── Greetings (whole-word only — won't match 'phishing') ──────
    greeting_words = ["hello", "hey", "namaste", "hii", "howdy", "yo", "sup"]
    greeting_phrases = ["how are you", "how r u", "whats up", "what's up",
                        "good morning", "good evening", "good afternoon", "how's it going"]
    is_greeting = (
        has_word(msg_lower, *greeting_words)
        or has_phrase(msg_lower, *greeting_phrases)
        or msg_lower.strip() in ["hi", "hey", "hello", "yo", "sup"]
    )

    if is_greeting:
        return (
            f"👋 Hey **{name}**! Great to chat with you.\n\n"
            "I'm **SecureDesk AI** — your cybersecurity expert. I can help with:\n\n"
            "• 🎣 **Phishing** — detect fake emails and scam links\n"
            "• 📁 **File Security** — risk scores, malware, PAN/Aadhaar detection\n"
            "• 🔐 **Data Protection** — passwords, MFA, zero-trust\n"
            "• ⚖️ **Compliance** — DPDP Act 2023, GDPR, ISO 27001\n"
            "• 🚀 **Platform Guide** — how to use every SecureDesk feature\n\n"
            "What security question can I help you with today?"
        )

    # ── Phishing ──────────────────────────────────────────────────
    if has_phrase(msg_lower, "phishing", "fake email", "suspicious email",
                  "scam email", "fraud email", "spam mail", "spot a phishing",
                  "identify phishing", "phishing attack"):
        return (
            "🔴 **How to Spot a Phishing Email — Complete Guide**\n\n"
            "**Top red flags:**\n"
            "• ⚡ **Urgency**: *'Your account will be deleted in 24 hours!'*\n"
            "• 📧 **Sender mismatch**: `support@paypa1.com` vs real `paypal.com`\n"
            "• 🔑 **Asks for**: password, OTP, CVV, Aadhaar, PAN card\n"
            "• 🌐 **IP in links**: `http://192.168.1.1/login` (not a real domain)\n"
            "• 👤 **Generic greeting**: *'Dear Customer'* instead of your name\n"
            "• 🔤 **Misspellings**: `Amaz0n`, `G00gle`, `PayPa1`\n"
            "• 📎 **Dangerous attachments**: `.exe`, `.bat`, `.zip`, `.vbs`\n\n"
            "**What to do immediately:**\n"
            "1. ❌ Do NOT click any links\n"
            "2. ❌ Do NOT enter credentials or share OTP\n"
            "3. ✅ Go to **/phishing** → paste the email → instant AI analysis\n"
            "4. ✅ Report to your IT security team\n"
            "5. ✅ Mark as phishing/spam and delete\n\n"
            "🇮🇳 *74% of Indian organizations faced phishing attacks in 2023. Use /phishing to scan any suspicious message instantly.*"
        )

    # ── Security tips ──────────────────────────────────────────────
    if has_phrase(msg_lower, "security tip", "best practice", "stay safe",
                  "how to be safe", "security advice", "protect my"):
        return (
            "🛡️ **Top 10 Corporate Cybersecurity Best Practices**\n\n"
            "1. 🔐 **Strong passwords + MFA** — blocks 99.9% of account attacks\n"
            "2. 🎣 **Phishing awareness** — verify sender before clicking links\n"
            "3. 📁 **Scan files before sharing** — use **/share** for AI analysis\n"
            "4. 💾 **Regular backups** — 3-2-1 rule (3 copies, 2 media, 1 offsite)\n"
            "5. 🔒 **Least privilege** — employees get only minimum access needed\n"
            "6. 🖥️ **Keep software updated** — 60% of breaches use unpatched vulns\n"
            "7. 🌐 **VPN for remote work** — never use public WiFi for company data\n"
            "8. 📧 **Email filtering** — block executable attachments at gateway\n"
            "9. 📋 **Audit logs** — know who accessed what (SecureDesk tracks this)\n"
            "10. 🚨 **Incident plan** — document exactly what to do when attacked\n\n"
            "**Quick wins right now:**\n"
            "• Enable 2FA on Gmail → Settings → Security → 2-Step Verification\n"
            "• Install **Bitwarden** (free password manager)\n"
            "• Check email leaks: [haveibeenpwned.com](https://haveibeenpwned.com)\n\n"
            "🇮🇳 *India is the #3 most attacked country globally. Every employee is a target.*"
        )

    # ── Ransomware / malware ──────────────────────────────────────
    if has_phrase(msg_lower, "ransomware", "malware", "virus", "trojan",
                  "worm", "infected", "hack", "cyber attack"):
        return (
            "🔴 **Ransomware & Malware — Complete Protection Guide**\n\n"
            "**What ransomware does:** Encrypts ALL your files and demands crypto payment.\n"
            "Famous attacks: WannaCry (2017), NotPetya, LockBit 3.0\n\n"
            "**How it spreads:**\n"
            "• Email attachments: `.exe`, `.bat`, `.vbs`, `.zip` files\n"
            "• Fake software download websites\n"
            "• USB drives from unknown sources\n"
            "• Unpatched Windows/macOS vulnerabilities\n\n"
            "**Prevention checklist:**\n"
            "• ✅ Never open executable attachments from email\n"
            "• ✅ Use **/share** to scan ALL files before receiving/sending\n"
            "• ✅ Keep OS and apps updated always\n"
            "• ✅ 3-2-1 backup strategy\n"
            "• ✅ Strong passwords + MFA on all accounts\n\n"
            "**If attacked:**\n"
            "1. 🔌 Disconnect from network IMMEDIATELY\n"
            "2. ❌ Do NOT pay the ransom (no recovery guarantee)\n"
            "3. 📞 Report to CERT-In: cert-in.org.in\n"
            "4. 💾 Restore from last clean backup"
        )

    # ── Passwords ─────────────────────────────────────────────────
    if has_phrase(msg_lower, "password", "credential", "account security",
                  "strong password", "password manager", "mfa", "two factor", "2fa"):
        return (
            "🔐 **Password Security — Complete Guide**\n\n"
            "**Strong password formula:**\n"
            "• Minimum **12 characters** (16+ for critical accounts)\n"
            "• Mix: `UPPERCASE + lowercase + numbers + symbols`\n"
            "• ✅ Good: `Sk@SecureDesk2024!Mumbai`\n"
            "• ❌ Bad: `password123`, `admin`, your name, birthday\n\n"
            "**Essential practices:**\n"
            "• 🔑 Use **Bitwarden** (free) — password manager for all accounts\n"
            "• 📱 Enable **2FA/MFA** on ALL important accounts\n"
            "• 🔄 Change corporate passwords every 90 days\n"
            "• 🚫 Never share via WhatsApp, email, or chat\n"
            "• 🔒 Unique password for every account\n\n"
            "**2FA methods (best to worst):**\n"
            "1. 🥇 Hardware key (YubiKey) — most secure\n"
            "2. 🥈 Authenticator app (Google Auth / Authy) — recommended\n"
            "3. 🥉 SMS OTP — convenient but vulnerable to SIM swap\n\n"
            "🇮🇳 *DPDP Act 2023 requires organizations to enforce strong credential policies.*"
        )

    # ── PAN / Aadhaar / sensitive data ────────────────────────────
    if has_phrase(msg_lower, "pan card", "aadhaar", "aadhar", "credit card",
                  "sensitive data", "pii", "personal data", "data leak", "ifsc"):
        return (
            "🔴 **Sensitive Data Detection — What SecureDesk Scans For**\n\n"
            "| Data Type | Example | Severity |\n"
            "|-----------|---------|----------|\n"
            "| PAN Card | `ABCDE1234F` | 🔴 High |\n"
            "| Aadhaar | `1234 5678 9012` | 🔴 High |\n"
            "| Credit/Debit Card | `4111 1111 1111 1111` | 🔴 Critical |\n"
            "| Bank IFSC | `SBIN0001234` | 🟡 Medium |\n"
            "| Bulk Phones | 10+ numbers | 🟡 Medium |\n"
            "| Bulk Emails | 5+ addresses | 🟡 Medium |\n\n"
            "**How the scan works:**\n"
            "1. Upload file at **/share**\n"
            "2. Text extracted from PDF, DOCX, or TXT automatically\n"
            "3. Regex patterns detect above data types\n"
            "4. Risk score increases by 30–45% per critical finding\n"
            "5. Full report with exact findings shown\n\n"
            "⚖️ **Legal risk:** Sharing PAN/Aadhaar without consent = **DPDP Act 2023 violation** → penalty up to **₹250 crore**"
        )

    # ── DPDP / compliance ─────────────────────────────────────────
    if has_phrase(msg_lower, "dpdp", "gdpr", "compliance", "regulation",
                  "data law", "iso 27001", "pci", "legal", "penalty"):
        return (
            "⚖️ **Cybersecurity Compliance in India**\n\n"
            "**🇮🇳 DPDP Act 2023 — India's Main Data Law:**\n"
            "• Protects personal data of all Indian citizens\n"
            "• Breach notification required within **72 hours**\n"
            "• Maximum penalty: **₹250 crore per violation**\n"
            "• Covers: PAN, Aadhaar, biometrics, financial data\n"
            "• Applies to ALL companies handling Indian user data\n\n"
            "**How SecureDesk helps you comply:**\n"
            "• ✅ Detects PAN/Aadhaar before files leave your org\n"
            "• ✅ Full audit trail (who sent what, when, to whom)\n"
            "• ✅ Risk-based classification with explainability\n"
            "• ✅ CSV export for compliance audit reports\n"
            "• ✅ Admin dashboard for real-time monitoring\n\n"
            "**Other frameworks:**\n"
            "• **ISO 27001** — Information security management\n"
            "• **SOC 2** — Security & availability controls\n"
            "• **PCI-DSS** — Required for card payment handling\n"
            "• **GDPR** — Required if serving EU customers"
        )

    # ── Risk score ────────────────────────────────────────────────
    if has_phrase(msg_lower, "risk score", "how does it work", "ai model",
                  "classification", "machine learning", "how securedesk"):
        return (
            "🤖 **SecureDesk AI — 4-Stage Risk Scoring**\n\n"
            "**Stage 1: File Text Extraction**\n"
            "PDF → PyPDF2 | DOCX → python-docx | TXT → direct read\n\n"
            "**Stage 2: Regex Pre-filter**\n"
            "Scans for PAN, Aadhaar, credit cards, IFSC, malware commands\n"
            "Each finding adds 25–45% to the content risk score\n\n"
            "**Stage 3: ML Classification**\n"
            "Random Forest model trained on 1000+ corporate email samples\n"
            "Analyzes: subject + body + file type + suspicious keywords\n\n"
            "**Stage 4: Final Blended Score**\n"
            "• 🟢 **0–34%** → Legitimate\n"
            "• 🟡 **35–69%** → Suspicious — review carefully\n"
            "• 🔴 **70–100%** → High Risk — flagged/blocked\n\n"
            "Every result shows **exact reasons** why it was flagged — specific keywords, PII found, malware signatures matched."
        )

    # ── Deployment ────────────────────────────────────────────────
    if has_phrase(msg_lower, "deploy", "deployment", "vercel", "render",
                  "production", "host", "go live", "publish"):
        return (
            "🚀 **Deploy SecureDesk — 3 Free Services**\n\n"
            "**Step 1: Database → MongoDB Atlas (free)**\n"
            "• Sign up at mongodb.com/atlas → Create M0 free cluster\n"
            "• Network Access → Allow `0.0.0.0/0`\n"
            "• Copy connection string\n\n"
            "**Step 2: Backend → Render.com (free)**\n"
            "• Root: `backend` | Python version: `3.11.9`\n"
            "• Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`\n"
            "• Add env vars: `MONGODB_URL`, `SECRET_KEY`, `ANTHROPIC_API_KEY`\n\n"
            "**Step 3: Frontend → Vercel (free)**\n"
            "• Root: `frontend` | Framework: Vite\n"
            "• Env var: `VITE_API_URL=https://your-backend.onrender.com/api`\n\n"
            "**Common errors:**\n"
            "• CORS error → Add Vercel URL to `FRONTEND_URL` env var on Render\n"
            "• MongoDB SSL → Set Python 3.11.9 on Render (fixes Python 3.14 SSL bug)\n"
            "• Build fails → Run `npm run build` locally first to check errors"
        )

    # ── Default (always intelligent) ─────────────────────────────
    return (
        f"🛡️ **SecureDesk AI** here to help, **{name}**!\n\n"
        f"You asked: *\"{msg[:90]}{'...' if len(msg) > 90 else ''}\"*\n\n"
        "I specialize in corporate cybersecurity. Here's what I cover:\n\n"
        "• 🎣 **Phishing** — *'How do I spot a phishing email?'*\n"
        "• 📁 **File Security** — *'What makes a file risky?'*\n"
        "• 🔐 **Passwords & MFA** — *'How do I secure my accounts?'*\n"
        "• 🦠 **Malware/Ransomware** — *'How do I prevent ransomware?'*\n"
        "• ⚖️ **DPDP Act 2023** — *'What is India's data protection law?'*\n"
        "• 🚀 **Deployment** — *'How do I deploy SecureDesk to production?'*\n\n"
        "Please ask a specific question and I'll give you a detailed answer!"
    )


async def call_anthropic_api(messages: list, api_key: str) -> str | None:
    try:
        import httpx
        api_msgs = [m for m in messages if m["role"] in ("user", "assistant")]
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                    "x-api-key": api_key,
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 700,
                    "system": SYSTEM_PROMPT,
                    "messages": api_msgs,
                }
            )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("content"):
                return data["content"][0].get("text")
    except Exception:
        pass
    return None


async def call_openai_api(messages: list, api_key: str) -> str | None:
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        api_msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
        api_msgs += [{"role": m["role"], "content": m["content"]} for m in messages[-10:] if m["role"] in ("user", "assistant")]
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo", messages=api_msgs, max_tokens=700, temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception:
        pass
    return None


@router.post("/conversation")
async def create_conversation(body: ConversationCreate, current_user=Depends(get_current_user)):
    conv_id = str(uuid.uuid4())
    await chat_collection.insert_one({
        "_id": conv_id, "user_id": current_user["_id"],
        "user_name": current_user["name"], "title": body.title,
        "messages": [], "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
    })
    return {"conversation_id": conv_id, "title": body.title}


@router.get("/conversations")
async def get_conversations(current_user=Depends(get_current_user)):
    cursor = chat_collection.find({"user_id": current_user["_id"]}, sort=[("updated_at", -1)]).limit(20)
    results = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        for k in ["created_at", "updated_at"]:
            if hasattr(c.get(k), "isoformat"):
                c[k] = c[k].isoformat()
        c.pop("messages", None)
        results.append(c)
    return results


@router.get("/conversation/{conv_id}")
async def get_conversation(conv_id: str, current_user=Depends(get_current_user)):
    conv = await chat_collection.find_one({"_id": conv_id, "user_id": current_user["_id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv["_id"] = str(conv["_id"])
    for k in ["created_at", "updated_at"]:
        if hasattr(conv.get(k), "isoformat"):
            conv[k] = conv[k].isoformat()
    return conv


@router.post("/conversation/{conv_id}/message")
async def send_message(conv_id: str, body: MessageIn, current_user=Depends(get_current_user)):
    conv = await chat_collection.find_one({"_id": conv_id, "user_id": current_user["_id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = conv.get("messages", [])
    user_msg = {
        "id": str(uuid.uuid4()), "role": "user",
        "content": body.message, "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(user_msg)

    history = [{"role": m["role"], "content": m["content"]} for m in messages[-12:] if m["role"] in ("user", "assistant")]

    ai_text = None

    # Try Anthropic first
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if anthropic_key and not anthropic_key.startswith("your_"):
        ai_text = await call_anthropic_api(history, anthropic_key)

    # Try OpenAI second
    if not ai_text:
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key and not openai_key.startswith("your_"):
            ai_text = await call_openai_api(history, openai_key)

    # Smart local fallback — always works
    if not ai_text:
        ai_text = smart_response(body.message, current_user.get("name", "there"))

    ai_msg = {
        "id": str(uuid.uuid4()), "role": "assistant",
        "content": ai_text, "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(ai_msg)

    title = conv.get("title", "New Conversation")
    if title == "New Conversation" and len(messages) == 2:
        title = body.message[:45] + ("..." if len(body.message) > 45 else "")

    await chat_collection.update_one(
        {"_id": conv_id},
        {"$set": {"messages": messages, "title": title, "updated_at": datetime.utcnow()}}
    )
    return {"user_message": user_msg, "assistant_message": ai_msg, "conversation_id": conv_id}


@router.delete("/conversation/{conv_id}")
async def delete_conversation(conv_id: str, current_user=Depends(get_current_user)):
    await chat_collection.delete_one({"_id": conv_id, "user_id": current_user["_id"]})
    return {"deleted": True}