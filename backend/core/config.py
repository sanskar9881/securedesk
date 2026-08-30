"""
Application configuration.

Single source of truth for every environment variable the backend reads.
Nothing outside this module may call os.getenv for application config.

Two rules govern this file:

1. Fail fast, fail loud. A missing or placeholder secret raises at import
   time, before the app binds a port. A security product that boots with
   `SECRET_KEY="changeme"` is worse than one that refuses to boot, because
   the first looks healthy.

2. Never rename a deployed variable silently. The canonical names below are
   the names already set in Render (MONGODB_URL, SECRET_KEY). The newer
   names from the architecture spec (MONGODB_URI, JWT_SECRET) are accepted
   as aliases so the two can co-exist during migration.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# ─────────────────────────────────────────────────────────────────────
# Secret quality checks
# ─────────────────────────────────────────────────────────────────────

# Values that appear in tutorials, .env.example files and this repo's own
# git history. Any of these in a secret slot means the secret was never set.
_PLACEHOLDER_PATTERNS = (
    r"^changeme",
    r"^your[_\-]",
    r"^replace[_\-]?me",
    r"^<.*>$",
    r"^(secret|password|test|dev|dummy|example|placeholder|xxx+)$",
)

_MIN_SECRET_CHARS = 32
_MIN_SECRET_BITS = 96
_MIN_DISTINCT_CHARS = 8


def _shannon_bits(value: str) -> float:
    """Total Shannon entropy of the string, in bits.

    A weak but useful floor: it cannot prove a secret is random, but it
    reliably rejects the failure we actually see in practice — a long
    string that is a repeated or near-repeated pattern.
    """
    if not value:
        return 0.0
    counts = Counter(value)
    n = len(value)
    per_char = -sum((c / n) * math.log2(c / n) for c in counts.values())
    return per_char * n


def _looks_like_placeholder(value: str) -> bool:
    low = value.strip().lower()
    return any(re.search(p, low) for p in _PLACEHOLDER_PATTERNS)


def _assert_strong_secret(value: str, field_name: str) -> str:
    """Raise unless `value` is plausibly a real, high-entropy secret."""
    value = (value or "").strip()

    if not value:
        raise ValueError(
            f"{field_name} is not set. Generate one with:\n"
            f"    python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    if _looks_like_placeholder(value):
        raise ValueError(
            f"{field_name} is set to a placeholder value. Replace it with a real secret:\n"
            f"    python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    if len(value) < _MIN_SECRET_CHARS:
        raise ValueError(
            f"{field_name} is {len(value)} characters; at least {_MIN_SECRET_CHARS} required. "
            f"Regenerate with: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    if len(set(value)) < _MIN_DISTINCT_CHARS:
        raise ValueError(
            f"{field_name} uses only {len(set(value))} distinct characters and is not random. "
            f"Regenerate with: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    if _shannon_bits(value) < _MIN_SECRET_BITS:
        raise ValueError(
            f"{field_name} has roughly {_shannon_bits(value):.0f} bits of entropy; "
            f"at least {_MIN_SECRET_BITS} required. "
            f"Regenerate with: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    return value


# ─────────────────────────────────────────────────────────────────────
# Settings
# ─────────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Runtime ──────────────────────────────────────────────────────
    # Not currently set in Render. Defaults to development so a local
    # checkout runs unchanged; production MUST set ENVIRONMENT=production
    # or the production-only guards below never engage.
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    EXPOSE_ERROR_DETAIL: bool = False

    # ── Database ─────────────────────────────────────────────────────
    MONGODB_URL: str = Field(
        validation_alias=AliasChoices("MONGODB_URL", "MONGODB_URI"),
    )
    DATABASE_NAME: str = "cybersec_db"

    # ── Auth (Phase 4) ───────────────────────────────────────────────
    SECRET_KEY: str = Field(
        validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET"),
    )
    ALGORITHM: str = "HS256"
    # TODO(revert-to-15): Phase 4's design intent is 15 — the access token
    # itself becomes a short-lived, low-value credential and real session
    # length comes from the revocable, rotating refresh token instead (see
    # REFRESH_TOKEN_EXPIRE_DAYS below). Temporarily reverted to the
    # pre-Phase-4 value of 1440 (24h) because the deployed frontend has no
    # refresh-on-401 (or proactive) interceptor yet — it stores
    # access_token and ignores refresh_token entirely, so at 15min every
    # live session would start expiring mid-use. refresh_token issuance
    # and POST /api/auth/refresh are unaffected by this and already work;
    # only the access token's own lifetime is reverted. Put this back to
    # 15 the same change that ships the frontend interceptor, not before —
    # leaving it at 1440 defeats the point of Phase 4 (an intercepted
    # access token stays valid for a full day with no revocation path).
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    # Refresh tokens rotate on every use (see services/token_service.py).
    # Each rotation slides the expiry forward by this many days, capped in
    # absolute terms by REFRESH_TOKEN_ABSOLUTE_MAX_DAYS regardless of how
    # often it's used — an indefinitely-renewable credential is not
    # meaningfully different from a permanent one.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_TOKEN_ABSOLUTE_MAX_DAYS: int = 90
    # Device tokens (Chrome extension). Longer-lived than a refresh token
    # because there's no human present to re-authenticate an unattended
    # extension install — revocation (GET/DELETE /api/auth/devices) is the
    # control instead of a short expiry.
    DEVICE_TOKEN_EXPIRE_DAYS: int = 180

    # ── Evidence chain (Phase 3) ─────────────────────────────────────
    # Optional until the evidence chain is built. EVIDENCE_ENABLED is the
    # switch that makes the signing key mandatory — see the validator below.
    # Until Phase 3 lands there is no chain to sign, and requiring the key
    # now would only break a live deploy for a feature that does not exist.
    EVIDENCE_ENABLED: bool = False
    EVIDENCE_SIGNING_KEY: str | None = None
    EVIDENCE_PUBLIC_KEY: str | None = None

    # ── AI providers ─────────────────────────────────────────────────
    # Absent keys are tolerated: the scan pipeline degrades to the local
    # regex tier by design. They are never required to boot.
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # ── Google Sign-In ───────────────────────────────────────────────
    # The OAuth 2.0 Web client ID from Google Cloud. This is not a secret
    # (it ships in the frontend bundle), but it IS the audience the backend
    # checks every Google credential against — a token minted for a
    # different client ID must not authenticate here. Empty disables the
    # POST /api/auth/google endpoint entirely (503), same "a capability
    # with no safe configuration stays off" rule as password reset.
    GOOGLE_CLIENT_ID: str = ""

    # ── URLs / CORS ──────────────────────────────────────────────────
    FRONTEND_URL: str = ""
    BACKEND_URL: str = ""
    # NoDecode is required: without it pydantic-settings tries to json.loads
    # this field straight from the environment and errors on a plain
    # comma-separated value, which is the form Render and every other host
    # actually supply. The validator below does the parsing instead.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = []

    # ── Email alerts ─────────────────────────────────────────────────
    SMTP_EMAIL: str = ""
    SMTP_PASSWORD: str = ""
    MANAGER_ALERT_EMAIL: str = ""

    # ── Billing ──────────────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # ── Validators ───────────────────────────────────────────────────

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, v: str) -> str:
        return _assert_strong_secret(v, "SECRET_KEY")

    @field_validator("MONGODB_URL")
    @classmethod
    def _validate_mongo_url(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("MONGODB_URL is not set.")
        if not v.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError(
                "MONGODB_URL must start with mongodb:// or mongodb+srv://"
            )
        return v

    @field_validator("ALGORITHM")
    @classmethod
    def _validate_algorithm(cls, v: str) -> str:
        v = (v or "").strip().upper()
        # "none" is the classic JWT bypass; symmetric HS* only is what the
        # current token code supports.
        if v not in ("HS256", "HS384", "HS512"):
            raise ValueError(f"Unsupported JWT ALGORITHM: {v!r}. Use HS256.")
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        """Accept a comma-separated string, a JSON array, or a real list."""
        if v is None or v == "":
            return []
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if self.ENVIRONMENT != "production":
            return self

        problems: list[str] = []

        # A wildcard origin with credentialed requests is an open door.
        if any("*" in o for o in self.CORS_ORIGINS):
            problems.append(
                "CORS_ORIGINS contains a wildcard. In production every origin "
                "must be listed exactly."
            )
        if not self.CORS_ORIGINS and not self.FRONTEND_URL:
            problems.append(
                "Neither CORS_ORIGINS nor FRONTEND_URL is set, so no browser "
                "origin can reach the API."
            )
        if self.MONGODB_URL.startswith("mongodb://localhost") or "127.0.0.1" in self.MONGODB_URL:
            problems.append("MONGODB_URL points at localhost in production.")
        if self.EXPOSE_ERROR_DETAIL:
            problems.append(
                "EXPOSE_ERROR_DETAIL is on in production; it leaks stack traces "
                "and driver messages to clients."
            )
        if self.EVIDENCE_ENABLED and not self.EVIDENCE_SIGNING_KEY:
            problems.append(
                "EVIDENCE_ENABLED is on but EVIDENCE_SIGNING_KEY is not set. "
                "An unsigned evidence chain is forgeable and has no audit value."
            )

        if problems:
            raise ValueError(
                "Refusing to start in production:\n  - " + "\n  - ".join(problems)
            )
        return self

    # ── Derived helpers ──────────────────────────────────────────────

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def google_signin_enabled(self) -> bool:
        """Google Sign-In needs a client ID to check credentials against.

        Without it there is no audience to verify the token for, so the
        endpoint stays off rather than accepting whatever it's handed.
        """
        return bool(self.GOOGLE_CLIENT_ID)

    @property
    def password_reset_enabled(self) -> bool:
        """Password reset requires a delivery channel.

        The reset token is a bearer credential for the account. If it cannot
        be delivered out-of-band to something only the account holder reads,
        there is no safe way to hand it out at all — so the flow stays off
        until SMTP is configured.
        """
        return bool(self.SMTP_EMAIL and self.SMTP_PASSWORD)

    @property
    def allowed_origins(self) -> list[str]:
        """Exact origin allowlist for CORS.

        Development adds the usual local Vite/CRA ports. Production returns
        only what was configured explicitly — no regex, no wildcard.
        """
        origins = list(self.CORS_ORIGINS)
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL.rstrip("/"))
        if not self.is_production:
            origins += [
                "http://localhost:5173", "http://localhost:5174",
                "http://localhost:3000",
                "http://127.0.0.1:5173", "http://127.0.0.1:5174",
            ]
        # dedupe, preserve order
        return list(dict.fromkeys(o for o in origins if o))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton. Import this, never Settings() directly."""
    return Settings()
