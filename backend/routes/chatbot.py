import os, uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db
from routes.auth import get_current_user

router   = APIRouter()
chat_col = db["chats"]

SYSTEM = """You are SecureDesk AI — a smart helpful assistant like ChatGPT.
Answer ANYTHING the user asks. Not limited to security.
You also have deep expertise in: cybersecurity, phishing, malware, DPDP Act 2023,
PAN/Aadhaar data protection, GDPR, ISO 27001, file security, DLP.
SecureDesk features: /dlp /phishing /activity /ai-copilot /compliance /ueba /whatsapp-logs.
Be conversational, clear, use markdown. Built by Sanskar Hadole."""

class MsgIn(BaseModel):
    message: str

class ConvCreate(BaseModel):
    title: str = "New Conversation"


async def call_ai(history: list) -> str | None:
    msgs = [{"role": m["role"], "content": m["content"]}
            for m in history if m["role"] in ("user","assistant")]

    # Try Anthropic
    key = os.getenv("ANTHROPIC_API_KEY","")
    if key and len(key) > 20 and not key.startswith("your_"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"Content-Type":"application/json",
                             "anthropic-version":"2023-06-01","x-api-key":key},
                    json={"model":"claude-haiku-4-5-20251001","max_tokens":1024,
                          "system":SYSTEM,"messages":msgs})
            if r.status_code == 200:
                return r.json()["content"][0]["text"]
        except Exception as e:
            print(f"Anthropic error: {e}")

    # Try OpenAI
    key2 = os.getenv("OPENAI_API_KEY","")
    if key2 and len(key2) > 20 and not key2.startswith("your_"):
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=key2)
            r = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role":"system","content":SYSTEM}] + msgs[-20:],
                max_tokens=1024, temperature=0.7)
            return r.choices[0].message.content
        except Exception as e:
            print(f"OpenAI error: {e}")
    return None


def local_fallback(msg: str, name: str) -> str:
    m = msg.lower()
    if any(w in m for w in ["hi","hello","hey","how are you","namaste"]):
        return (f"Hey **{name}**! 👋 I'm SecureDesk AI.\n\n"
                "I can help with anything — security, coding, writing, or general questions.\n\n"
                "> ⚠️ Add `ANTHROPIC_API_KEY` in Render → Environment for full AI responses.")
    if "phishing" in m:
        return "## 🎣 Phishing Red Flags\n• Sender domain mismatch\n• Urgency tactics\n• Requests for OTP/password\n• Suspicious links\n\n**Use `/phishing` to scan any email instantly.**"
    if "password" in m:
        return "## 🔐 Password Tips\n• Min 12 characters\n• Mix letters, numbers, symbols\n• Use Bitwarden (free)\n• Enable 2FA everywhere"
    if "dpdp" in m or "compliance" in m:
        return "## ⚖️ DPDP Act 2023\n• India's data protection law\n• Penalty: up to ₹250 Crore\n• 72-hour breach notification\n\n**Go to `/compliance` for your one-click compliance report.**"
    return (f"I need an API key to answer **\"{msg[:60]}\"** properly.\n\n"
            "**Enable full AI:**\n"
            "1. Go to console.anthropic.com → get free API key\n"
            "2. Render → Environment → add `ANTHROPIC_API_KEY`\n"
            "3. Save → redeploys in 3 min → full ChatGPT-level responses")


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

    history = [{"role":m["role"],"content":m["content"]}
               for m in messages[-30:] if m["role"] in ("user","assistant")]

    ai_text = await call_ai(history)
    if not ai_text:
        ai_text = local_fallback(body.message, user.get("name","there"))

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
