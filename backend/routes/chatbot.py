import os, re, uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db
from routes.auth import get_current_user

router   = APIRouter()
chat_col = db["chats"]

SYSTEM = """You are SecureDesk AI — a smart, helpful assistant. You can answer ANYTHING the user asks, just like ChatGPT. You are not limited to security topics.

You have deep expertise in cybersecurity, data protection, DPDP Act 2023, phishing, malware, file security, compliance. But you also help with coding, writing, general questions, math, advice — anything.

Be conversational, helpful, and natural. Use markdown formatting. Keep responses focused and clear.

SecureDesk features: /dlp (file scanner), /phishing (email analysis), /activity (audit logs), /ai-copilot (query data), /compliance (DPDP report), /ueba (behavior analytics), /whatsapp-logs (WhatsApp monitoring), /organization (team management), /pricing (billing plans).

Built by Sanskar Hadole."""


class MsgIn(BaseModel):
    message: str

class ConvCreate(BaseModel):
    title: str = "New Conversation"


async def call_llm(history: list) -> str | None:
    """Try Anthropic first, then OpenAI. Return None only if both fail."""
    msgs = [{"role": m["role"], "content": m["content"]}
            for m in history if m["role"] in ("user","assistant")]

    # Anthropic
    key = os.getenv("ANTHROPIC_API_KEY","")
    if key and not key.startswith("your_") and len(key) > 20:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"Content-Type":"application/json",
                             "anthropic-version":"2023-06-01",
                             "x-api-key": key},
                    json={"model":"claude-haiku-4-5-20251001","max_tokens":1024,
                          "system": SYSTEM, "messages": msgs}
                )
            if r.status_code == 200:
                return r.json()["content"][0]["text"]
            else:
                print(f"[Anthropic] {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"[Anthropic error] {e}")

    # OpenAI
    key2 = os.getenv("OPENAI_API_KEY","")
    if key2 and not key2.startswith("your_") and len(key2) > 20:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=key2)
            api_msgs = [{"role":"system","content":SYSTEM}]
            api_msgs += msgs[-20:]
            r = await client.chat.completions.create(
                model="gpt-3.5-turbo", messages=api_msgs,
                max_tokens=1024, temperature=0.7
            )
            return r.choices[0].message.content
        except Exception as e:
            print(f"[OpenAI error] {e}")

    return None


def fallback(message: str, name: str) -> str:
    """Only used when NO API key is configured. Covers common questions well."""
    msg = message.lower().strip()

    # Greetings
    greet = ["hi","hey","hello","namaste","hii","howdy","yo","sup"]
    greet_phrases = ["how are you","how r u","whats up","good morning","good evening","what's up"]
    if msg in greet or any(p in msg for p in greet_phrases):
        return (f"Hey **{name}**! 👋 I'm SecureDesk AI.\n\n"
                "I can help with **anything** — security questions, general knowledge, coding, writing, or just a chat.\n\n"
                "**Quick shortcuts:**\n"
                "• Ask me anything about cybersecurity\n"
                "• Ask me general questions like ChatGPT\n"
                "• Use `/dlp` to scan files, `/phishing` to check emails\n\n"
                "> ⚠️ *No API key detected. Add `ANTHROPIC_API_KEY` in Render → Environment to enable full AI.*")

    if any(w in msg for w in ["phishing","fake email","scam","fraud email"]):
        return ("## 🎣 Phishing Detection Guide\n\n"
                "**Red flags:**\n• Sender domain mismatch (paypa1.com)\n• Urgency: 'Act NOW or lose access'\n"
                "• Requests OTP, CVV, Aadhaar, PAN\n• IP addresses in links\n• Generic 'Dear Customer'\n\n"
                "**What to do:** Go to `/phishing` → paste the email → instant AI analysis")

    if any(w in msg for w in ["password","mfa","2fa","two factor"]):
        return ("## 🔐 Password Security\n\n"
                "• Minimum 12 characters\n• Mix uppercase, lowercase, numbers, symbols\n"
                "• Use **Bitwarden** (free password manager)\n• Enable 2FA on every account\n"
                "• Never reuse passwords\n\n✅ Good: `Sk@SecureDesk2024!`\n❌ Bad: `password123`")

    if any(w in msg for w in ["dpdp","compliance","gdpr","penalty"]):
        return ("## ⚖️ DPDP Act 2023\n\n"
                "India's data protection law effective 2024.\n\n"
                "**Key facts:**\n• Penalty: up to **₹250 Crore** per violation\n"
                "• 72-hour breach notification required\n• Covers PAN, Aadhaar, financial data\n\n"
                "**SecureDesk helps:** Go to `/compliance` → one-click DPDP compliance report")

    if any(w in msg for w in ["ransomware","malware","virus","hack"]):
        return ("## 🦠 Ransomware Protection\n\n"
                "**Prevention:**\n• Never open .exe/.bat from emails\n• Keep OS updated\n"
                "• 3-2-1 backup rule\n• Scan files at `/dlp` before sharing\n\n"
                "**If attacked:** Disconnect network → Don't pay → Report to CERT-In → Restore backup")

    if any(w in msg for w in ["securedesk","dlp","feature","how does"]):
        return ("## 🛡️ SecureDesk Features\n\n"
                "• `/dlp` — AI file scanner (PAN, Aadhaar, credit cards)\n"
                "• `/phishing` — Email threat detector\n"
                "• `/activity` — Full audit trail\n"
                "• `/ai-copilot` — Ask AI about your security data\n"
                "• `/compliance` — DPDP compliance report\n"
                "• `/ueba` — Behavior analytics\n"
                "• `/whatsapp-logs` — WhatsApp file monitoring\n"
                "• `/organization` — Team management\n"
                "• `/pricing` — Billing & plans")

    # Any other question — honest fallback
    return (f"I received your message but I need an API key to give you a full AI response.\n\n"
            f"**You asked:** *\"{message[:100]}\"*\n\n"
            "**To enable full ChatGPT-level AI:**\n"
            "1. Go to **console.anthropic.com** → create free account → copy API key\n"
            "2. Go to **dashboard.render.com** → your backend → Environment\n"
            "3. Add: `ANTHROPIC_API_KEY` = your key (starts with `sk-ant-`)\n"
            "4. Save → Render redeploys in ~3 min\n"
            "5. Come back and ask anything — I'll answer like ChatGPT\n\n"
            "> The key gives you $5 free credit — enough for ~2000 conversations")


@router.post("/conversation")
async def create_conv(body: ConvCreate, user=Depends(get_current_user)):
    cid = str(uuid.uuid4())
    await chat_col.insert_one({"_id":cid,"user_id":user["_id"],"user_name":user["name"],
        "title":body.title,"messages":[],"created_at":datetime.utcnow(),"updated_at":datetime.utcnow()})
    return {"conversation_id":cid,"title":body.title}


@router.get("/conversations")
async def list_convs(user=Depends(get_current_user)):
    cur = chat_col.find({"user_id":user["_id"]},sort=[("updated_at",-1)]).limit(20)
    out = []
    async for d in cur:
        d["_id"] = str(d["_id"])
        for k in ("created_at","updated_at"):
            if hasattr(d.get(k),"isoformat"): d[k] = d[k].isoformat()
        d.pop("messages",None)
        out.append(d)
    return out


@router.get("/conversation/{cid}")
async def get_conv(cid:str, user=Depends(get_current_user)):
    doc = await chat_col.find_one({"_id":cid,"user_id":user["_id"]})
    if not doc: raise HTTPException(404,"Not found")
    doc["_id"] = str(doc["_id"])
    for k in ("created_at","updated_at"):
        if hasattr(doc.get(k),"isoformat"): doc[k] = doc[k].isoformat()
    return doc


@router.post("/conversation/{cid}/message")
async def send_msg(cid:str, body:MsgIn, user=Depends(get_current_user)):
    doc = await chat_col.find_one({"_id":cid,"user_id":user["_id"]})
    if not doc: raise HTTPException(404,"Conversation not found")

    messages = doc.get("messages",[])
    user_msg = {"id":str(uuid.uuid4()),"role":"user",
                "content":body.message,"timestamp":datetime.utcnow().isoformat()}
    messages.append(user_msg)

    # Send full history to AI (last 30 messages for context)
    history = [{"role":m["role"],"content":m["content"]}
               for m in messages[-30:] if m["role"] in ("user","assistant")]

    # Try real AI first
    ai_text = await call_llm(history)

    # Only use fallback if no API key works
    if not ai_text:
        ai_text = fallback(body.message, user.get("name","there"))

    ai_msg = {"id":str(uuid.uuid4()),"role":"assistant",
              "content":ai_text,"timestamp":datetime.utcnow().isoformat()}
    messages.append(ai_msg)

    title = doc.get("title","New Conversation")
    if title == "New Conversation" and len(messages) == 2:
        title = body.message[:50] + ("..." if len(body.message)>50 else "")

    await chat_col.update_one({"_id":cid},
        {"$set":{"messages":messages,"title":title,"updated_at":datetime.utcnow()}})

    return {"user_message":user_msg,"assistant_message":ai_msg,"conversation_id":cid}


@router.delete("/conversation/{cid}")
async def del_conv(cid:str, user=Depends(get_current_user)):
    await chat_col.delete_one({"_id":cid,"user_id":user["_id"]})
    return {"deleted":True}
