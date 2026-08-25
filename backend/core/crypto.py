"""
Chain signing and canonical hashing — the cryptographic core of the
evidence chain (Phase 3).

Why signatures, not just hashes: a hash chain alone stops someone editing
one row without touching the rest — it does not stop an attacker with full
database write access, who can simply recompute every hash forward and
produce a valid-looking chain. What that attacker cannot do is forge a
signature over the chain head without the private key, which lives only in
an environment variable, never in the database. verify_chain() (see
services/evidence_service.py) checks both: the hash links AND the head
signature. Rewriting hashes without the key produces a chain whose
signature no longer verifies.

Key format: Ed25519 keys are handled as raw 32-byte seeds/points,
base64-encoded for storage in an environment variable. Generate a pair
with `python -m scripts.generate_evidence_keypair`.
"""
from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

GENESIS_HASH = "0" * 64


# ─────────────────────────────────────────────────────────────────────
# Canonical JSON + hashing
# ─────────────────────────────────────────────────────────────────────

def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        # Always includes the UTC offset — see core/database.py's tz_aware
        # client config. A naive datetime here would make the same logical
        # entry hash differently depending on how it round-tripped through
        # Mongo, which is exactly the kind of instability a content hash
        # cannot tolerate.
        if value.tzinfo is None:
            raise ValueError("naive datetime cannot be hashed — evidence timestamps must be tz-aware")
        return value.isoformat()
    raise TypeError(f"not JSON-serialisable for canonical hashing: {type(value)!r}")


def canonical_json(body: dict) -> str:
    """Deterministic JSON: sorted keys, no incidental whitespace.

    Two dicts with the same content always serialise identically regardless
    of insertion order — required for entry_hash to be reproducible from
    the same logical entry.
    """
    return json.dumps(body, sort_keys=True, separators=(",", ":"), default=_json_default)


def entry_hash(body: dict, prev_hash: str) -> str:
    """entry_hash = SHA-256(canonical_json(body) + prev_hash).

    `body` must NOT include prev_hash or entry_hash itself — they are
    concatenated in, not hashed as fields, so the formula is unambiguous
    about what depends on what: this entry's content, chained to the
    previous entry's hash.
    """
    payload = canonical_json(body).encode("utf-8") + prev_hash.encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ─────────────────────────────────────────────────────────────────────
# Ed25519 signing
# ─────────────────────────────────────────────────────────────────────

def _load_private_key(b64_seed: str) -> Ed25519PrivateKey:
    try:
        raw = base64.b64decode(b64_seed, validate=True)
    except Exception as exc:
        raise ValueError("EVIDENCE_SIGNING_KEY is not valid base64") from exc
    if len(raw) != 32:
        raise ValueError(
            f"EVIDENCE_SIGNING_KEY decodes to {len(raw)} bytes; an Ed25519 seed is 32. "
            "Generate one with: python -m scripts.generate_evidence_keypair"
        )
    return Ed25519PrivateKey.from_private_bytes(raw)


def _load_public_key(b64_point: str) -> Ed25519PublicKey:
    try:
        raw = base64.b64decode(b64_point, validate=True)
    except Exception as exc:
        raise ValueError("EVIDENCE_PUBLIC_KEY is not valid base64") from exc
    if len(raw) != 32:
        raise ValueError(f"EVIDENCE_PUBLIC_KEY decodes to {len(raw)} bytes; an Ed25519 public key is 32.")
    return Ed25519PublicKey.from_public_bytes(raw)


def head_signing_message(org_id: str, seq: int, head_hash: str, timestamp: datetime) -> bytes:
    """The exact bytes signed for a chain-head advance or a checkpoint.

    Includes org_id: without it, a signature minted for one organisation's
    head could be replayed as if it were another's — same seq, same hash
    happens to collide is unlikely, but the signature should not rely on
    that. Timestamp is included so a signature cannot be replayed to
    "re-confirm" a stale head at a later time.
    """
    if timestamp.tzinfo is None:
        raise ValueError("naive datetime cannot be signed — evidence timestamps must be tz-aware")
    return f"{org_id}|{seq}|{head_hash}|{timestamp.isoformat()}".encode("utf-8")


def sign_head(org_id: str, seq: int, head_hash: str, timestamp: datetime, private_key_b64: str) -> str:
    key = _load_private_key(private_key_b64)
    message = head_signing_message(org_id, seq, head_hash, timestamp)
    return base64.b64encode(key.sign(message)).decode("ascii")


def verify_head_signature(
    org_id: str, seq: int, head_hash: str, timestamp: datetime,
    signature_b64: str, public_key_b64: str,
) -> bool:
    try:
        key = _load_public_key(public_key_b64)
        message = head_signing_message(org_id, seq, head_hash, timestamp)
        key.verify(base64.b64decode(signature_b64), message)
        return True
    except Exception:
        # InvalidSignature (tampered/wrong key), ValueError (malformed
        # base64/key length) — all mean "does not verify", not a crash.
        return False


def generate_keypair() -> tuple[str, str]:
    """Returns (private_key_b64, public_key_b64) for a fresh Ed25519 pair."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    priv_b64 = base64.b64encode(
        private_key.private_bytes(
            serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()
        )
    ).decode("ascii")
    pub_b64 = base64.b64encode(
        public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    ).decode("ascii")
    return priv_b64, pub_b64
