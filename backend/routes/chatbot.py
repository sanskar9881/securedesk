import os, re, uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db
from routes.auth import get_current_user

router = APIRouter()
chat_col = db["chats"]

# ── System prompt — tells the AI who it is ─────────────────────────
SYSTEM = """You are SecureDesk AI — a smart, friendly assistant built into SecureDesk, 
a corporate cybersecurity and Data Loss Prevention (DLP) platform.

You can help with ANYTHING the user asks — general questions, coding, writing, 
advice, explanations — just like ChatGPT. You are not limited to security topics.

However, you have deep expertise in:
- Cybersecurity, phishing, malware, ransomware
- Data loss prevention (DLP) and file security
- Indian data laws: DPDP Act 2023, IT Act 2000
- PAN cards, Aadhaar, credit card data protection
- GDPR, ISO 27001, SOC 2, PCI-DSS compliance
- SecureDesk platform features

SecureDesk features you can guide users to:
- /dlp       → AI file scanner (upload files to check risk)
- /phishing  → Paste emails/URLs for instant threat analysis
- /activity  → Full audit trail of all file operations
- /ai-copilot → Ask security questions in natural language
- /fingerprints → SHA-256 file fingerprint tracker
- /share     → Send files with AI risk scanning
- /history   → Your transaction history

Personality: helpful, concise, smart. Use markdown formatting.
Use bullet points for lists. Keep responses focused and clear.
If asked about security topics, give expert-level answers.
If asked general questions, answer them naturally and helpfully.

Built with love from Sanskar Hadole."""


class MsgIn(BaseModel):
    message: str

class ConvCreate(BaseModel):
    title: str = "New Conversation"


# ── API callers ────────────────────────────────────────────────────

async def call_anthropic(history: list) -> str | None:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key or key.startswith("your_"):
        return None
    try:
        import httpx
        # Build messages — only user/assistant roles
        msgs = [{"role": m["role"], "content": m["content"]}
                for m in history if m["role"] in ("user", "assistant")]
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                    "x-api-key": key,
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 1024,
                    "system": SYSTEM,
                    "messages": msgs,
                }
            )
        if r.status_code == 200:
            return r.json()["content"][0]["text"]
        else:
            print(f"Anthropic error {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"Anthropic exception: {e}")
    return None


async def call_openai(history: list) -> str | None:
    key = os.getenv("OPENAI_API_KEY", "")
    if not key or key.startswith("your_"):
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=key)
        msgs   = [{"role": "system", "content": SYSTEM}]
        msgs  += [{"role": m["role"], "content": m["content"]}
                  for m in history[-20:] if m["role"] in ("user", "assistant")]
        r = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=msgs,
            max_tokens=1024,
            temperature=0.7,
        )
        return r.choices[0].message.content
    except Exception as e:
        print(f"OpenAI exception: {e}")
    return None


def local_response(message: str, name: str) -> str:
    """
    Intelligent local fallback — only used when NO API keys are set.
    Handles common questions without needing an API.
    """
    msg = message.lower().strip()

    # Greetings
    greet_words = ["hello", "hey", "namaste", "hii", "howdy", "yo", "sup"]
    greet_phrases = ["how are you", "how r u", "whats up", "what's up",
                     "good morning", "good evening", "good afternoon"]
    is_greet = (
        msg in ["hi", "hello", "hey", "yo", "sup", "hii"]
        or any(re.search(r'\b' + w + r'\b', msg) for w in greet_words)
        or any(p in msg for p in greet_phrases)
    )
    if is_greet:
        return (
            f"Hey **{name}**! 👋 I'm SecureDesk AI.\n\n"
            "I can help with **anything** — security questions, general knowledge, "
            "coding help, writing, or just a conversation.\n\n"
            "**SecureDesk features I can guide you to:**\n"
            "• 🔍 `/dlp` — Scan files for sensitive data\n"
            "• 🎣 `/phishing` — Analyze suspicious emails\n"
            "• 📊 `/activity` — View audit logs\n"
            "• 🤖 `/ai-copilot` — Query your security data\n\n"
            "What can I help you with today?\n\n"
            "> 💡 *Add your Anthropic API key in Render environment variables to unlock full AI responses.*"
        )

    # What can you do
    if any(p in msg for p in ["what can you do", "what do you do", "help me", "your features", "capabilities"]):
        return (
            "I'm **SecureDesk AI** — here's what I can help with:\n\n"
            "**🔐 Cybersecurity**\n"
            "• Phishing detection and email analysis\n"
            "• File risk scoring and sensitive data detection\n"
            "• Malware, ransomware, and threat guidance\n"
            "• DPDP Act 2023, GDPR, ISO 27001 compliance\n\n"
            "**📊 SecureDesk Platform**\n"
            "• How to use every feature\n"
            "• Interpreting risk scores\n"
            "• Managing your security dashboard\n\n"
            "**💬 General Assistant**\n"
            "• Answer any question like ChatGPT\n"
            "• Coding help, writing, research\n\n"
            "> Add your API key in Render for full AI power."
        )

    # Phishing
    if re.search(r'\bphishing\b', msg) or "fake email" in msg or "scam email" in msg:
        return (
            "## 🎣 How to Spot Phishing\n\n"
            "**Key red flags:**\n"
            "• Sender domain mismatch — `paypa1.com` vs `paypal.com`\n"
            "• Urgency: *'Your account will be deleted in 24 hours!'*\n"
            "• Asking for password, OTP, CVV, PAN, or Aadhaar\n"
            "• Suspicious links — hover to check the real URL\n"
            "• Generic greetings like *'Dear Customer'*\n"
            "• Attachments: `.exe`, `.bat`, `.vbs`, `.zip`\n\n"
            "**What to do:**\n"
            "1. Don't click any links\n"
            "2. Don't share any credentials\n"
            "3. Go to `/phishing` in SecureDesk — paste the email for instant AI analysis\n"
            "4. Report to your IT team"
        )

    # Passwords
    if re.search(r'\bpassword\b', msg) or "credentials" in msg or "strong password" in msg:
        return (
            "## 🔐 Password Security\n\n"
            "**Strong password formula:**\n"
            "• Minimum 12 characters\n"
            "• Mix: `UPPERCASE + lowercase + numbers + symbols`\n"
            "• ✅ Example: `Sk@SecureDesk2024!`\n"
            "• ❌ Avoid: name, birthday, `password123`\n\n"
            "**Best practices:**\n"
            "• Use **Bitwarden** (free password manager)\n"
            "• Enable **2FA** on every account\n"
            "• Never reuse passwords\n"
            "• Change every 90 days for work accounts\n\n"
            "🇮🇳 Under DPDP Act 2023, weak passwords = compliance liability."
        )

    # DPDP / compliance
    if "dpdp" in msg or "gdpr" in msg or "compliance" in msg or "data law" in msg:
        return (
            "## ⚖️ DPDP Act 2023 — India's Data Protection Law\n\n"
            "**Key points:**\n"
            "• Protects personal data of all Indian citizens\n"
            "• Breach must be reported within **72 hours**\n"
            "• Maximum penalty: **₹250 crore per violation**\n"
            "• Covers: PAN, Aadhaar, biometrics, financial data\n"
            "• Applies to every company with Indian user data\n\n"
            "**How SecureDesk helps:**\n"
            "• Detects PAN/Aadhaar before files leave your org\n"
            "• Full audit trail for every file transaction\n"
            "• Compliance-ready CSV exports\n"
            "• Real-time risk alerts"
        )

    # Ransomware / malware
    if re.search(r'\b(ransomware|malware|virus|trojan|hack)\b', msg):
        return (
            "## 🦠 Ransomware Protection\n\n"
            "**How ransomware works:**\n"
            "Encrypts all your files → demands payment to restore.\n"
            "Famous examples: WannaCry, LockBit, NotPetya.\n\n"
            "**Prevention:**\n"
            "• Never open `.exe/.bat/.vbs` attachments from email\n"
            "• Keep OS and software updated\n"
            "• 3-2-1 backup rule (3 copies, 2 media types, 1 offsite)\n"
            "• Use SecureDesk `/dlp` to scan all files before sharing\n\n"
            "**If attacked:**\n"
            "1. 🔌 Disconnect from network immediately\n"
            "2. ❌ Do NOT pay the ransom\n"
            "3. 📞 Report to CERT-In: cert-in.org.in\n"
            "4. 💾 Restore from last clean backup"
        )

    # SecureDesk features
    if any(p in msg for p in ["securedesk", "how does it work", "risk score", "dlp", "scan"]):
        return (
            "## 🛡️ How SecureDesk Works\n\n"
            "**Step 1 — Upload or scan a file** at `/dlp`\n\n"
            "**Step 2 — AI analyzes it:**\n"
            "• Regex scans for PAN, Aadhaar, credit cards, API keys\n"
            "• AI classifier explains WHY it's risky\n"
            "• Risk score: 🟢 LOW / 🟡 MEDIUM / 🔴 HIGH\n\n"
            "**Step 3 — System decides:**\n"
            "• ✅ ALLOW — safe to share\n"
            "• ⚠️ WARN — review before sharing\n"
            "• 🚫 BLOCK — do not share\n\n"
            "**Step 4 — Everything logged** in `/activity` for audit trail"
        )

    # Default — honest about limitation
    return (
        f"I received your message: *\"{message[:80]}{'...' if len(message) > 80 else ''}\"*\n\n"
        "I can answer this properly with a real AI response, but I need an API key to do so.\n\n"
        "**To unlock full AI (like ChatGPT):**\n"
        "1. Go to **console.anthropic.com** → get a free API key\n"
        "2. Go to **Render.com** → your backend service → Environment\n"
        "3. Add: `ANTHROPIC_API_KEY` = your key\n"
        "4. Redeploy — I'll answer anything intelligently\n\n"
        "**Topics I can already help with locally:**\n"
        "• Phishing detection\n"
        "• Password security\n"
        "• DPDP Act 2023\n"
        "• Ransomware protection\n"
        "• SecureDesk features"
    )


# ── Routes ─────────────────────────────────────────────────────────

@router.post("/conversation")
async def create_conv(body: ConvCreate, user=Depends(get_current_user)):
    cid = str(uuid.uuid4())
    await chat_col.insert_one({
        "_id": cid, "user_id": user["_id"], "user_name": user["name"],
        "title": body.title, "messages": [],
        "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
    })
    return {"conversation_id": cid, "title": body.title}


@router.get("/conversations")
async def list_convs(user=Depends(get_current_user)):
    cur = chat_col.find({"user_id": user["_id"]}, sort=[("updated_at", -1)]).limit(20)
    out = []
    async for d in cur:
        d["_id"] = str(d["_id"])
        for k in ("created_at", "updated_at"):
            if hasattr(d.get(k), "isoformat"): d[k] = d[k].isoformat()
        d.pop("messages", None)
        out.append(d)
    return out


@router.get("/conversation/{cid}")
async def get_conv(cid: str, user=Depends(get_current_user)):
    doc = await chat_col.find_one({"_id": cid, "user_id": user["_id"]})
    if not doc: raise HTTPException(404, "Conversation not found")
    doc["_id"] = str(doc["_id"])
    for k in ("created_at", "updated_at"):
        if hasattr(doc.get(k), "isoformat"): doc[k] = doc[k].isoformat()
    return doc


@router.post("/conversation/{cid}/message")
async def send_msg(cid: str, body: MsgIn, user=Depends(get_current_user)):
    doc = await chat_col.find_one({"_id": cid, "user_id": user["_id"]})
    if not doc: raise HTTPException(404, "Conversation not found")

    messages = doc.get("messages", [])

    # Add user message
    user_msg = {
        "id": str(uuid.uuid4()), "role": "user",
        "content": body.message, "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(user_msg)

    # Build full history for context (last 20 messages)
    history = [{"role": m["role"], "content": m["content"]}
               for m in messages[-20:] if m["role"] in ("user", "assistant")]

    # Try AI — priority: Anthropic → OpenAI → local fallback
    ai_text = await call_anthropic(history)
    if not ai_text:
        ai_text = await call_openai(history)
    if not ai_text:
        ai_text = local_response(body.message, user.get("name", "there"))

    ai_msg = {
        "id": str(uuid.uuid4()), "role": "assistant",
        "content": ai_text, "timestamp": datetime.utcnow().isoformat(),
    }
    messages.append(ai_msg)

    # Auto-set title from first message
    title = doc.get("title", "New Conversation")
    if title == "New Conversation" and len(messages) == 2:
        title = body.message[:50] + ("..." if len(body.message) > 50 else "")

    await chat_col.update_one(
        {"_id": cid},
        {"$set": {"messages": messages, "title": title, "updated_at": datetime.utcnow()}}
    )

    return {"user_message": user_msg, "assistant_message": ai_msg, "conversation_id": cid}


@router.delete("/conversation/{cid}")
async def delete_conv(cid: str, user=Depends(get_current_user)):
    await chat_col.delete_one({"_id": cid, "user_id": user["_id"]})
    return {"deleted": True}