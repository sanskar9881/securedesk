"""
Vision service — detects Indian identity documents inside images.

The gap this closes: the DLP scan pipeline extracts text from PDFs and
DOCX, then runs it through regex_engine. A photographed Aadhaar card,
PAN card, or bank cheque shared as a JPEG/PNG has no extractable text at
all — extract_text() falls through to decoding raw image bytes as UTF-8
with errors ignored, which yields noise, and the file scores LOW every
time regardless of what it actually shows. That is the fatal gap: exactly
the documents DPDP cares about most move as photos on WhatsApp, and the
pipeline was blind to them.

Fallback chain, fixed order, same shape as services/ai_service.py:
Claude vision -> OpenAI vision -> local conservative fallback. The
conservative fallback never returns ALLOW — an image that could not be
inspected is unverified, not safe, and is scored accordingly (see
_conservative_fallback). This mirrors the fail-to-warn policy the rest of
the scan pipeline will apply once Phase 6 exists: blocking on an AI outage
destroys adoption, silently allowing destroys the evidence claim, so an
uninspectable image is scored as if it were moderately risky rather than
either extreme.

Escalation-only: analyze_image() returns a risk_delta that the caller
combines as `total_score = max(total_score, total_score + risk_delta)`
(see routes/analyze.py). Vision can raise a regex-derived score, never
lower it — risk_delta is never negative.

Never transcribes or returns actual PII values — only document
categories, a confidence label, and short non-identifying reasons. Findings
here become evidence_log payload content (see services/evidence_service.py),
so the same "categories and counts, never values" rule that already holds
for regex_engine.scan() has to hold here too.
"""
from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass, field

import httpx

from core.config import get_settings

log = logging.getLogger("securedesk.vision")

MAX_LONG_EDGE = 1400
VISION_TIMEOUT_SECONDS = 20.0

CLAUDE_VISION_MODEL = "claude-haiku-4-5-20251001"
OPENAI_VISION_MODEL = "gpt-4o-mini"

# Weight per detected document type — the vision-analogue of
# regex_engine.RISK_WEIGHTS. Deliberately higher than the corresponding
# text-regex weights (aadhaar text match: 35, aadhaar_card photo: 45):
# a photographed, visually-confirmed ID card is much higher-confidence
# evidence than a regex match against a 12-digit run of text, which can be
# a coincidental number with no relation to a real Aadhaar card at all.
DOCUMENT_WEIGHTS: dict[str, int] = {
    "aadhaar_card": 45, "pan_card": 40, "passport": 45, "voter_id": 30,
    "driving_licence": 30, "bank_cheque": 40, "bank_statement": 35,
    "credit_debit_card": 50, "salary_slip": 25, "itr_form": 30,
    "medical_report": 35, "signed_contract": 20,
    "screenshot_with_credentials": 50,
}

# The subset carrying government/financial identity data DPDP regulates
# most directly. A single high-confidence detection in this tier gets a
# bonus on top of its base weight, specifically so that "upload a photo of
# an Aadhaar card" alone reaches BLOCK (>=60, see regex_engine.HIGH_THRESHOLD)
# rather than landing at WARN. Without this bonus, aadhaar_card's base
# weight of 45 alone — the realistic case, since a bare image upload gives
# regex_engine nothing to find in accompanying text — would only reach
# MEDIUM/WARN, which is not an acceptable outcome for a photographed
# national ID: the whole reason this service exists is that these
# documents deserve to be caught decisively, not marginally flagged.
# Only applied when the model itself reports high confidence; a medium or
# low confidence classification stays at the base weight, which is the
# conservative direction to be uncertain in.
CRITICAL_TIER = frozenset({"aadhaar_card", "pan_card", "passport", "credit_debit_card"})
CRITICAL_TIER_HIGH_CONFIDENCE_BONUS = 20

# All AI tiers failed and the image could not be inspected at all. Not
# escalated to BLOCK — we genuinely don't know what's in it, and forcing a
# block on ignorance is worse than a warning that says so. Fixed at a
# level that reaches MEDIUM/WARN from a typical zero regex base, per the
# fail-to-warn policy.
UNVERIFIED_RISK_DELTA = 30

VALID_CATEGORIES = frozenset(DOCUMENT_WEIGHTS)
VALID_CONFIDENCE = frozenset({"high", "medium", "low"})

SYSTEM_VISION = """You are a document classifier for an Indian data-loss-prevention system.
Look at the image and identify whether it shows any of these document types:
aadhaar_card, pan_card, passport, voter_id, driving_licence, bank_cheque,
bank_statement, credit_debit_card, salary_slip, itr_form, medical_report,
signed_contract, screenshot_with_credentials.

Rules:
- Never transcribe, quote, or output any actual ID number, name, address,
  account number, or other value visible in the image. Categories only.
- If the image shows no such document, return an empty document_types list.
- "confidence" reflects how sure you are the image genuinely shows that
  document type (not a related but different document) — "high" only when
  the image clearly and unambiguously shows that specific document.

Return ONLY this JSON, no other text:
{
  "document_types": ["aadhaar_card"],
  "confidence": "high",
  "reasons": ["Image shows a government-issued ID card with the Aadhaar emblem and format"]
}"""


@dataclass
class VisionResult:
    risk_delta: int = 0
    document_types: list[str] = field(default_factory=list)
    confidence: str = "low"
    reasons: list[str] = field(default_factory=list)
    unverified: bool = False   # True only when every AI tier failed
    provider: str = "none"     # "claude" | "openai" | "fallback" | "none" (not an image / no findings)


def _classify_risk_delta(document_types: list[str], confidence: str) -> int:
    if not document_types:
        return 0
    weights = [DOCUMENT_WEIGHTS.get(t, 0) for t in document_types if t in VALID_CATEGORIES]
    if not weights:
        return 0
    delta = max(weights)
    # Which type(s) produced the max weight — the bonus applies if any of
    # them is in the critical tier (aadhaar_card/pan_card/passport/
    # credit_debit_card), not just the first one returned.
    top_types = {t for t in document_types if DOCUMENT_WEIGHTS.get(t, 0) == delta}
    if confidence == "high" and top_types & CRITICAL_TIER:
        delta += CRITICAL_TIER_HIGH_CONFIDENCE_BONUS
    # A second distinct high-weight category (e.g. a photo showing both a
    # PAN card and a bank cheque) adds a smaller amount on top — multiple
    # real documents in one image is worse than one, but not linearly so.
    extra_categories = len(set(document_types)) - 1
    if extra_categories > 0:
        delta += min(extra_categories, 3) * 10
    return min(delta, 100)


# ─────────────────────────────────────────────────────────────────────
# Image preparation
# ─────────────────────────────────────────────────────────────────────

def downscale_image(content: bytes) -> tuple[bytes, str]:
    """Downscale to a max 1400px long edge before sending to any API —
    keeps request size and provider cost bounded, and caps decode
    dimensions before Pillow ever holds a decompression-bomb-scale bitmap
    in memory. Returns (jpeg_bytes, media_type)."""
    from PIL import Image

    with Image.open(io.BytesIO(content)) as img:
        img = img.convert("RGB")
        w, h = img.size
        long_edge = max(w, h)
        if long_edge > MAX_LONG_EDGE:
            scale = MAX_LONG_EDGE / long_edge
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        return out.getvalue(), "image/jpeg"


# ─────────────────────────────────────────────────────────────────────
# Provider calls
# ─────────────────────────────────────────────────────────────────────

def _parse_vision_json(raw: str) -> dict | None:
    try:
        import json
        start, end = raw.find("{"), raw.rfind("}") + 1
        data = json.loads(raw[start:end])
        types = [t for t in data.get("document_types", []) if t in VALID_CATEGORIES]
        confidence = data.get("confidence") if data.get("confidence") in VALID_CONFIDENCE else "low"
        reasons = [str(r)[:200] for r in data.get("reasons", [])][:5]
        return {"document_types": types, "confidence": confidence, "reasons": reasons}
    except Exception:
        return None


async def _call_claude_vision(image_b64: str, media_type: str) -> dict | None:
    key = get_settings().ANTHROPIC_API_KEY.strip()
    if not key or key.startswith("your_"):
        return None
    try:
        async with httpx.AsyncClient(timeout=VISION_TIMEOUT_SECONDS) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={"Content-Type": "application/json",
                         "anthropic-version": "2023-06-01",
                         "x-api-key": key},
                json={
                    "model": CLAUDE_VISION_MODEL, "max_tokens": 400,
                    "system": SYSTEM_VISION,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                            {"type": "text", "text": "Classify this image per the system instructions."},
                        ],
                    }],
                },
            )
        if r.status_code == 200:
            data = r.json()
            content = data.get("content", [])
            if content:
                return _parse_vision_json(content[0].get("text", ""))
        else:
            log.warning("claude vision error status=%d", r.status_code)
    except httpx.TimeoutException:
        log.warning("claude vision timeout after %.0fs", VISION_TIMEOUT_SECONDS)
    except Exception as e:
        log.warning("claude vision exception: %s", e)
    return None


async def _call_openai_vision(image_b64: str, media_type: str) -> dict | None:
    key = get_settings().OPENAI_API_KEY.strip()
    if not key or key.startswith("your_"):
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=key, timeout=VISION_TIMEOUT_SECONDS)
        r = await client.chat.completions.create(
            model=OPENAI_VISION_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_VISION},
                {"role": "user", "content": [
                    {"type": "text", "text": "Classify this image per the system instructions."},
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                ]},
            ],
            max_tokens=400, temperature=0.1,
        )
        text = r.choices[0].message.content or ""
        return _parse_vision_json(text)
    except Exception as e:
        log.warning("openai vision exception: %s", e)
        return None


def _conservative_fallback() -> VisionResult:
    """All AI tiers failed. Never ALLOW: an uninspectable image is treated
    as unverified, not as safe. See module docstring."""
    return VisionResult(
        risk_delta=UNVERIFIED_RISK_DELTA,
        document_types=[],
        confidence="low",
        reasons=["Image could not be inspected by AI vision (all providers unavailable) — "
                 "treated as unverified per compliance policy, not allowed by default."],
        unverified=True,
        provider="fallback",
    )


# ─────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────

async def analyze_image(content: bytes) -> VisionResult:
    """
    Claude -> OpenAI -> conservative fallback, in that fixed order (same
    tier discipline as services/ai_service.py's text classification).
    Never raises — a provider exception is caught and treated as that
    tier failing over to the next one.
    """
    try:
        image_bytes, media_type = downscale_image(content)
    except Exception as e:
        log.warning("image decode failed, cannot analyze: %s", e)
        return _conservative_fallback()

    image_b64 = base64.b64encode(image_bytes).decode("ascii")

    parsed = await _call_claude_vision(image_b64, media_type)
    provider = "claude"
    if parsed is None:
        parsed = await _call_openai_vision(image_b64, media_type)
        provider = "openai"

    if parsed is None:
        return _conservative_fallback()

    document_types = parsed["document_types"]
    confidence = parsed["confidence"]
    risk_delta = _classify_risk_delta(document_types, confidence)

    return VisionResult(
        risk_delta=risk_delta,
        document_types=document_types,
        confidence=confidence,
        reasons=parsed["reasons"],
        unverified=False,
        provider=provider if document_types or parsed["reasons"] else "none",
    )
