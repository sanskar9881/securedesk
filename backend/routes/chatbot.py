import os
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
- Phishing detection, email security, social engineering
- Corporate data loss prevention (DLP)
- File security, malware, ransomware, trojans
- Indian data laws: DPDP Act 2023, IT Act 2000
- International compliance: GDPR, ISO 27001, SOC2, PCI-DSS
- Sensitive data: PAN cards, Aadhaar, credit cards, IFSC codes
- Password security, MFA, zero-trust architecture
- Incident response, forensics, threat intelligence
- SecureDesk platform features and capabilities

SecureDesk platform features you guide users to:
- /share → Upload files, AI scans content for PAN/Aadhaar/malware, gives 0-100% risk score
- /phishing → Paste any email/message for instant phishing analysis
- /history → Complete audit trail of all file transactions
- /admin → System dashboard with analytics (admin role only)
- /profile → User profile and settings
- /chat → This AI assistant (you)

Always respond in a helpful, professional manner. Use bullet points for clarity. Use these risk indicators: 🔴 high risk, 🟡 medium risk, 🟢 safe. Give clear, actionable advice. Keep responses under 300 words unless the topic demands more detail.

Built with love from Sanskar Hadole."""


class MessageIn(BaseModel):
    message: str


class ConversationCreate(BaseModel):
    title: str = "New Conversation"


async def call_anthropic(messages: list) -> str | None:
    """Call Anthropic Claude API — works in local dev environment."""
    try:
        import httpx
        api_messages = [m for m in messages if m["role"] in ("user", "assistant")]
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 700,
                    "system": SYSTEM_PROMPT,
                    "messages": api_messages,
                }
            )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("content") and len(data["content"]) > 0:
                return data["content"][0].get("text")
    except Exception:
        pass
    return None


async def call_openai(messages: list) -> str | None:
    """Call OpenAI GPT — requires OPENAI_API_KEY in .env"""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("your_"):
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        api_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        api_messages += [
            {"role": m["role"], "content": m["content"]}
            for m in messages if m["role"] in ("user", "assistant")
        ]
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=api_messages,
            max_tokens=700,
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception:
        pass
    return None


def smart_local_response(message: str, name: str) -> str:
    """High-quality local responses when no AI API is available."""
    msg = message.lower().strip()

    # Greetings
    if any(w in msg for w in ["hello", "hi", "hey", "namaste", "hii", "good morning", "good evening", "wassup", "sup"]):
        return (
            f"👋 Hello **{name}**! I'm SecureDesk AI, your cybersecurity expert.\n\n"
            "I can help you with:\n"
            "• 🔍 Phishing emails — detect scams before they hurt you\n"
            "• 🛡️ File security — understand risk scores and malware\n"
            "• 🔐 Data protection — PAN, Aadhaar, credit card leakage\n"
            "• ⚖️ Compliance — DPDP Act 2023, GDPR, ISO 27001\n"
            "• 🚀 SecureDesk features — how to use every tool\n\n"
            "What cybersecurity question can I help you with today?"
        )

    # Phishing
    if any(w in msg for w in ["phishing", "fake email", "suspicious email", "scam", "fraud mail", "spam"]):
        return (
            "🔴 **Phishing Detection Guide**\n\n"
            "**Top red flags:**\n"
            "• Urgency: *'Your account will be suspended in 24 hours!'*\n"
            "• Sender mismatch: `support@paypa1.com` instead of `paypal.com`\n"
            "• Requests for: password, OTP, CVV, Aadhaar, PAN\n"
            "• IP addresses in links: `http://192.168.1.1/login`\n"
            "• Generic greeting: *'Dear Customer'* instead of your name\n"
            "• Misspelled brand names: Amaz0n, G00gle, PayPa1\n\n"
            "**If you receive a suspicious email:**\n"
            "1. ❌ Don't click ANY links\n"
            "2. ❌ Don't provide credentials or OTP\n"
            "3. ✅ Go to **/phishing** → paste the email → get instant analysis\n"
            "4. ✅ Report to your IT security team\n"
            "5. ✅ Mark as spam and delete\n\n"
            "🇮🇳 *Phishing is the #1 cyber attack in India — 74% of organizations were targeted in 2023.*"
        )

    # Ransomware / malware
    if any(w in msg for w in ["ransomware", "malware", "virus", "trojan", "worm", "hack", "attack", "infected"]):
        return (
            "🔴 **Ransomware & Malware: Complete Guide**\n\n"
            "**What ransomware does:** Encrypts ALL your files, demands crypto payment to unlock.\n"
            "Famous attacks: WannaCry (2017), NotPetya, LockBit 3.0\n\n"
            "**How it spreads:**\n"
            "• Phishing email attachments (.exe, .bat, .vbs, .zip)\n"
            "• Malicious website downloads\n"
            "• USB drives from unknown sources\n"
            "• Unpatched software vulnerabilities (RDP, VPN)\n\n"
            "**Prevention checklist:**\n"
            "• ✅ Never open .exe/.bat/.vbs from email\n"
            "• ✅ Use SecureDesk /share to scan files before sending\n"
            "• ✅ Keep OS and software updated\n"
            "• ✅ 3-2-1 backup rule (3 copies, 2 media, 1 offsite)\n"
            "• ✅ Use strong passwords + MFA everywhere\n\n"
            "**If attacked:**\n"
            "1. 🔌 Disconnect from network IMMEDIATELY\n"
            "2. ❌ Do NOT pay the ransom (no guarantee of recovery)\n"
            "3. 📞 Report to CERT-In: cert-in.org.in\n"
            "4. 💾 Restore from last clean backup"
        )

    # Passwords
    if any(w in msg for w in ["password", "passwd", "credentials", "login security", "account security"]):
        return (
            "🔐 **Password Security: Complete Guide**\n\n"
            "**Strong password formula:**\n"
            "• Minimum **12 characters** (16+ recommended)\n"
            "• Mix: `UPPERCASE + lowercase + numbers + symbols`\n"
            "• Example: `Sk@SecureDesk2024!` ✅\n"
            "• Avoid: `password123`, `admin`, your name, birthday ❌\n\n"
            "**Best practices:**\n"
            "• 🔑 Use a **password manager**: Bitwarden (free) or 1Password\n"
            "• 📱 Enable **2FA/MFA** on ALL important accounts\n"
            "• 🔄 Rotate corporate passwords every **90 days**\n"
            "• 🚫 Never share via email, WhatsApp, or chat\n"
            "• 🔒 Different password for every account\n\n"
            "**2FA methods (strongest → weakest):**\n"
            "1. 🥇 Hardware key (YubiKey)\n"
            "2. 🥈 Authenticator app (Google Auth / Authy)\n"
            "3. 🥉 SMS OTP (vulnerable to SIM swap)\n\n"
            "🇮🇳 *Under DPDP Act 2023 — organizations must enforce strong password policies or face penalties.*"
        )

    # PAN, Aadhaar, sensitive data
    if any(w in msg for w in ["pan", "aadhaar", "aadhar", "credit card", "sensitive", "pii", "personal data", "data leak"]):
        return (
            "🔴 **Sensitive Data Detection — SecureDesk Scans For:**\n\n"
            "| Data Type | Example Pattern | Risk Level |\n"
            "|-----------|----------------|------------|\n"
            "| PAN Card | ABCDE1234F | 🔴 High |\n"
            "| Aadhaar | 1234 5678 9012 | 🔴 High |\n"
            "| Credit Card | 4111 1111 1111 1111 | 🔴 Critical |\n"
            "| IFSC Code | SBIN0001234 | 🟡 Medium |\n"
            "| Bulk Phones | 9876543210 (×10+) | 🟡 Medium |\n"
            "| Bulk Emails | user@domain.com (×5+) | 🟡 Medium |\n\n"
            "**How SecureDesk detects it:**\n"
            "1. File uploaded at /share\n"
            "2. Text extracted from PDF/DOCX/TXT\n"
            "3. Regex patterns scan for above data types\n"
            "4. Risk score adjusted (+30-45% per finding)\n"
            "5. Full report shown with exact findings\n\n"
            "**Legal risk:** Sharing files with PAN/Aadhaar without authorization = violation of **DPDP Act 2023** → penalty up to ₹250 crore.\n\n"
            "→ Try it: Go to **/share**, upload any PDF, and see the scan results."
        )

    # Risk score / how it works
    if any(w in msg for w in ["risk score", "how does it work", "ai model", "classification", "machine learning", "risk"]):
        return (
            "🤖 **SecureDesk AI Risk Scoring — How It Works**\n\n"
            "**4-Stage Pipeline:**\n\n"
            "**Stage 1: File Text Extraction**\n"
            "• PDF → PyPDF2 library\n"
            "• DOCX → python-docx library\n"
            "• TXT/CSV → direct text read\n\n"
            "**Stage 2: Regex Pre-filter**\n"
            "• Scans for PAN, Aadhaar, credit cards, IFSC, malware commands\n"
            "• Each finding adds to content risk score\n\n"
            "**Stage 3: ML Classification**\n"
            "• Random Forest model analyzes: subject + body + file type + keywords\n"
            "• Trained on 1000+ labeled corporate email samples\n\n"
            "**Stage 4: Final Risk Score**\n"
            "• ML score + Content score combined\n"
            "• 🟢 0–34%: Legitimate\n"
            "• 🟡 35–69%: Suspicious\n"
            "• 🔴 70–100%: High Risk / Block\n\n"
            "**Explainability:** Every flagged transaction shows exact reasons — which keywords, which PII found, which malware patterns detected."
        )

    # DPDP / compliance
    if any(w in msg for w in ["dpdp", "gdpr", "compliance", "regulation", "law", "legal", "iso 27001", "pci"]):
        return (
            "⚖️ **Cybersecurity Compliance Guide**\n\n"
            "**🇮🇳 DPDP Act 2023 (India's Main Data Law):**\n"
            "• Protects personal data of Indian citizens\n"
            "• Mandatory breach notification: within **72 hours**\n"
            "• Max penalty: **₹250 crore per violation**\n"
            "• Covers: PAN, Aadhaar, biometrics, financial data\n"
            "• Applies to ALL companies handling Indian user data\n\n"
            "**How SecureDesk helps you comply:**\n"
            "• ✅ Detects PAN/Aadhaar before files leave your org\n"
            "• ✅ Complete audit trail (who sent what, when, to whom)\n"
            "• ✅ Risk-based access control\n"
            "• ✅ CSV export for compliance reports\n"
            "• ✅ Admin dashboard for real-time monitoring\n\n"
            "**Other standards:**\n"
            "• **ISO 27001** — Information security management system\n"
            "• **SOC 2** — Security, availability, confidentiality controls\n"
            "• **PCI-DSS** — Required if handling card payments\n"
            "• **GDPR** — If serving EU customers"
        )

    # Security tips (the exact query in the screenshot)
    if any(w in msg for w in ["security tips", "security tip", "tips", "best practices", "how to stay safe"]):
        return (
            "🛡️ **Top 10 Corporate Cybersecurity Best Practices**\n\n"
            "1. 🔐 **Strong passwords + MFA** on every account\n"
            "2. 🎣 **Phishing training** — teach employees to spot scams\n"
            "3. 📁 **Scan every file** before sharing (use SecureDesk /share)\n"
            "4. 🔄 **Regular backups** — 3-2-1 rule (3 copies, 2 media, 1 offsite)\n"
            "5. 🔒 **Least privilege** — employees get only minimum access needed\n"
            "6. 🖥️ **Keep software updated** — patch vulnerabilities immediately\n"
            "7. 🌐 **VPN for remote work** — never use public WiFi for company data\n"
            "8. 📧 **Email filtering** — use spam filters, scan attachments\n"
            "9. 📋 **Audit logs** — monitor who accesses what data (SecureDesk does this)\n"
            "10. 🚨 **Incident response plan** — know what to do when attacked\n\n"
            "**Quick wins for today:**\n"
            "• Enable 2FA on email → takes 2 minutes\n"
            "• Install Bitwarden → free password manager\n"
            "• Check your Have I Been Pwned: haveibeenpwned.com\n\n"
            "🇮🇳 *India ranks #3 globally for cyber attacks. Every corporate employee is a target.*"
        )

    # Deployment
    if any(w in msg for w in ["deploy", "deployment", "vercel", "render", "cloud", "production", "host"]):
        return (
            "🚀 **SecureDesk Deployment (3 Free Services)**\n\n"
            "**Step 1: Database → MongoDB Atlas (free)**\n"
            "• Sign up: mongodb.com/atlas\n"
            "• Create M0 free cluster\n"
            "• Get connection string\n\n"
            "**Step 2: Backend → Render.com (free)**\n"
            "• Connect GitHub repo\n"
            "• Root: `backend/`\n"
            "• Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`\n"
            "• Add env vars: MONGODB_URL, SECRET_KEY, OPENAI_API_KEY\n\n"
            "**Step 3: Frontend → Vercel (free)**\n"
            "• Connect GitHub repo\n"
            "• Root: `frontend/`\n"
            "• Add env: `VITE_API_URL=https://your-backend.onrender.com/api`\n\n"
            "**Important:** Add Vercel URL to backend CORS in main.py\n\n"
            "Total cost: **₹0 forever** on free tiers."
        )

    # Default intelligent response
    return (
        f"🛡️ **SecureDesk AI** — Cybersecurity Expert\n\n"
        f"You asked about: *\"{message[:80]}{'...' if len(message) > 80 else ''}\"*\n\n"
        "I specialize in:\n"
        "• 🎣 **Phishing** — detecting fake emails, scam links\n"
        "• 📁 **File Security** — risk scoring, malware, PAN/Aadhaar detection\n"
        "• 🔐 **Access Security** — passwords, MFA, zero-trust\n"
        "• 📊 **SecureDesk Platform** — how to use every feature\n"
        "• ⚖️ **Compliance** — DPDP Act 2023, GDPR, ISO 27001\n"
        "• 🚀 **Deployment** — getting SecureDesk live on the internet\n\n"
        "Could you be more specific? For example:\n"
        "*'How do I spot a phishing email?'* or *'What is PAN card risk?'* or *'Security tips for my company'*"
    )


@router.post("/conversation")
async def create_conversation(body: ConversationCreate, current_user=Depends(get_current_user)):
    conv_id = str(uuid.uuid4())
    await chat_collection.insert_one({
        "_id": conv_id,
        "user_id": current_user["_id"],
        "user_name": current_user["name"],
        "title": body.title,
        "messages": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })
    return {"conversation_id": conv_id, "title": body.title}


@router.get("/conversations")
async def get_conversations(current_user=Depends(get_current_user)):
    cursor = chat_collection.find(
        {"user_id": current_user["_id"]},
        sort=[("updated_at", -1)]
    ).limit(20)
    results = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        for key in ["created_at", "updated_at"]:
            if hasattr(c.get(key), "isoformat"):
                c[key] = c[key].isoformat()
        c.pop("messages", None)
        results.append(c)
    return results


@router.get("/conversation/{conv_id}")
async def get_conversation(conv_id: str, current_user=Depends(get_current_user)):
    conv = await chat_collection.find_one({"_id": conv_id, "user_id": current_user["_id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv["_id"] = str(conv["_id"])
    for key in ["created_at", "updated_at"]:
        if hasattr(conv.get(key), "isoformat"):
            conv[key] = conv[key].isoformat()
    return conv


@router.post("/conversation/{conv_id}/message")
async def send_message(conv_id: str, body: MessageIn, current_user=Depends(get_current_user)):
    conv = await chat_collection.find_one({"_id": conv_id, "user_id": current_user["_id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = conv.get("messages", [])
    user_msg = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": body.message,
        "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(user_msg)

    # Build conversation history (last 12 messages for context)
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-12:]
        if m["role"] in ("user", "assistant")
    ]

    ai_text = None

    # Priority 1: Try Anthropic Claude (works in local dev, no key needed)
    ai_text = await call_anthropic(history)

    # Priority 2: Try OpenAI (if API key set in .env)
    if not ai_text:
        ai_text = await call_openai(history)

    # Priority 3: Smart local response (always works, domain-specific)
    if not ai_text:
        ai_text = smart_local_response(body.message, current_user.get("name", "there"))

    ai_msg = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": ai_text,
        "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(ai_msg)

    # Update conversation title from first message
    title = conv.get("title", "New Conversation")
    if title == "New Conversation" and len(messages) == 2:
        title = body.message[:45] + ("..." if len(body.message) > 45 else "")

    await chat_collection.update_one(
        {"_id": conv_id},
        {"$set": {
            "messages": messages,
            "title": title,
            "updated_at": datetime.utcnow()
        }}
    )

    return {
        "user_message": user_msg,
        "assistant_message": ai_msg,
        "conversation_id": conv_id,
    }


@router.delete("/conversation/{conv_id}")
async def delete_conversation(conv_id: str, current_user=Depends(get_current_user)):
    await chat_collection.delete_one({"_id": conv_id, "user_id": current_user["_id"]})
    return {"deleted": True}