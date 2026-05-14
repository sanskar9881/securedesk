
import os, json
import httpx

SYSTEM_SECURITY = """You are SecureDesk AI — an expert data security classifier.
Analyze file content for sensitive data, security risks, and compliance violations.
Always return structured JSON. Be precise and explain WHY something is risky."""

SYSTEM_COPILOT = """You are SecureDesk Manager Copilot.
You answer security questions based on real system data provided to you.
Be concise, factual, use bullet points. Never make up data."""


async def call_anthropic(messages: list, system: str, max_tokens: int = 600) -> str | None:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key or key.startswith("your_"):
        return None
    try:
        async with httpx.AsyncClient(timeout=25) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={"Content-Type": "application/json",
                         "anthropic-version": "2023-06-01",
                         "x-api-key": key},
                json={"model": "claude-haiku-4-5-20251001", "max_tokens": max_tokens,
                      "system": system, "messages": messages}
            )
        if r.status_code == 200:
            return r.json()["content"][0]["text"]
    except Exception:
        pass
    return None


async def call_openai(messages: list, system: str, max_tokens: int = 600) -> str | None:
    key = os.getenv("OPENAI_API_KEY", "")
    if not key or key.startswith("your_"):
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=key)
        msgs   = [{"role": "system", "content": system}] + messages
        r      = await client.chat.completions.create(
            model="gpt-3.5-turbo", messages=msgs,
            max_tokens=max_tokens, temperature=0.3,
        )
        return r.choices[0].message.content
    except Exception:
        pass
    return None


async def classify_file(text: str, filename: str, regex_findings: dict) -> dict:
    """Ask LLM to classify file sensitivity. Returns structured dict."""
    prompt = f"""Analyze this file for data security risks.
File: {filename}
Regex detections: {json.dumps(regex_findings) if regex_findings else "none"}
Content (first 700 chars): {text[:700]}

Return ONLY this JSON (no other text):
{{
  "is_sensitive": true,
  "sensitivity_reason": "Clear one-sentence explanation of WHY this is risky",
  "data_types_found": ["PAN card", "phone numbers"],
  "risk_level": "HIGH",
  "recommended_action": "BLOCK",
  "confidence": "HIGH"
}}"""
    msgs = [{"role": "user", "content": prompt}]
    raw  = await call_anthropic(msgs, SYSTEM_SECURITY, 300)
    if not raw:
        raw = await call_openai(msgs, SYSTEM_SECURITY, 300)
    if raw:
        try:
            s, e = raw.find("{"), raw.rfind("}") + 1
            return json.loads(raw[s:e])
        except Exception:
            pass
    return {
        "is_sensitive": bool(regex_findings),
        "sensitivity_reason": "Classified by regex engine — add API key for AI explanation",
        "data_types_found": list(regex_findings.keys()),
        "risk_level": "MEDIUM" if regex_findings else "LOW",
        "recommended_action": "WARN" if regex_findings else "ALLOW",
        "confidence": "MEDIUM",
    }


async def copilot_answer(question: str, context: str, user_name: str) -> str:
    """Answer manager question using DB context."""
    prompt = f"""MANAGER QUESTION: {question}

LIVE SYSTEM DATA:
{context}

Answer the question using only the data above. Be specific."""
    msgs = [{"role": "user", "content": prompt}]
    ans  = await call_anthropic(msgs, SYSTEM_COPILOT, 700)
    if not ans:
        ans = await call_openai(msgs, SYSTEM_COPILOT, 700)
    if ans:
        return ans
    lines = [l for l in context.split("\n") if l.strip().startswith("-")][:10]
    return ("Based on system data:\n" + "\n".join(lines)) if lines else "No matching data found."
