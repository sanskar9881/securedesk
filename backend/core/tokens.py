"""
Opaque bearer-token primitives shared by refresh tokens and device tokens.

Both are the same shape underneath: a high-entropy random string, prefixed
so its kind is recognisable at a glance (in logs, and by core.device_auth
choosing which verification path to take), stored in Mongo only as its
SHA-256 hash. The raw value exists in exactly one place ever — the response
body of the call that minted it — and is never recoverable from the
database. Same principle core/crypto.py documents for the evidence-chain
signing key: a secret that can be read back out of storage is not a secret.

Access tokens are unrelated to this module — they stay JWTs (core.config /
routes.auth), self-contained and unable to be revoked before they expire by
design. That is exactly why they are kept short-lived
(Settings.ACCESS_TOKEN_EXPIRE_MINUTES) and why refresh tokens exist at all:
revocation has to live somewhere, and it lives here instead.
"""
from __future__ import annotations

import hashlib
import secrets

REFRESH_TOKEN_PREFIX = "srt_"   # SecureDesk Refresh Token
DEVICE_TOKEN_PREFIX = "sdt_"    # SecureDesk Device Token

_RANDOM_BYTES = 32   # 256 bits of entropy


def new_opaque_token(prefix: str) -> str:
    return f"{prefix}{secrets.token_urlsafe(_RANDOM_BYTES)}"


def hash_token(raw_token: str) -> str:
    """SHA-256 hex digest. Deterministic (unlike bcrypt) is required here —
    verification is a lookup by exact hash, not a compare against one known
    candidate the way a password check is."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
