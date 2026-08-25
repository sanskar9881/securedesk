"""
Refresh-token rotation (with reuse detection) and scoped device tokens.

Two independent bearer-credential families, both opaque (not JWT) and
looked up by SHA-256 hash — see core/tokens.py for why. Access tokens
remain plain JWTs and are unaffected by anything in this module; this is
everything ABOVE the access token: what mints a new one after the old one
expires, and what an unattended piece of software (the Chrome extension,
not a human who can re-enter a password) authenticates with instead of a
login session.

Refresh rotation, reuse detection
----------------------------------
Every successful /refresh call retires the presented token (sets
rotated_at) and mints a new one in the same family. A refresh token
presented a SECOND time — because it was stolen and the thief raced the
legitimate client, or because it was stolen and replayed after the
legitimate client had already rotated past it — means the family is
compromised: something other than the single legitimate client now holds a
token from this chain. There is no way to tell, after the fact, whether
"second presentation" was theft or the legitimate client retrying a
dropped response, so the only safe response is to revoke the entire family
and force a fresh login. This is the standard refresh-token-rotation
reuse-detection pattern, not a SecureDesk invention.

Device tokens
-------------
A device token authenticates software acting on a user's behalf without
that user present to re-enter credentials. It is deliberately NOT a
substitute login: it carries `scopes`, a fixed small set of capabilities,
and core.device_auth only accepts it on routes that explicitly opt in to a
specific required scope. A device token can never reach a route that only
depends on get_current_user — it isn't a JWT, so jose.jwt.decode rejects it
outright, which is what keeps this additive rather than a silent widening
of every session-authenticated endpoint's attack surface.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from core.config import get_settings
from core.tokens import DEVICE_TOKEN_PREFIX, REFRESH_TOKEN_PREFIX, hash_token, new_opaque_token
from repositories.device_tokens import DeviceTokensRepository
from repositories.refresh_tokens import RefreshTokensRepository
from services import evidence_service

log = logging.getLogger("securedesk.tokens")

# The only capabilities a device token can ever be scoped to. Kept
# deliberately small — one entry, for the one integration that exists
# (routes/analyze.py's scan endpoints, via core.device_auth). Add a new
# scope only alongside the route that actually checks for it; an unused
# scope is a capability nobody is enforcing.
DEVICE_TOKEN_SCOPES = frozenset({"dlp:scan"})
DEFAULT_DEVICE_SCOPES = ["dlp:scan"]


class RefreshTokenError(Exception):
    """A presented refresh token is invalid, expired, or revoked."""


class RefreshReuseDetected(RefreshTokenError):
    """A refresh token was presented a second time. The whole family has
    just been revoked; the caller must log in again."""


class DeviceTokenError(Exception):
    """A presented device token is invalid, expired, revoked, or lacks the
    scope the route requires."""


# ─────────────────────────────────────────────────────────────────────
# Refresh tokens
# ─────────────────────────────────────────────────────────────────────

async def issue_refresh_family(db, user_id: str) -> str:
    """Start a brand-new rotation family (login/register). Returns the raw
    token — this is the only time it exists outside the caller's hands."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    raw = new_opaque_token(REFRESH_TOKEN_PREFIX)
    doc = {
        "_id": hash_token(raw),
        "family_id": str(uuid.uuid4()),
        "user_id": user_id,
        "issued_at": now,
        "family_started_at": now,
        "expires_at": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "rotated_at": None,
        "revoked_at": None,
    }
    await RefreshTokensRepository(db).create(doc)
    return raw


async def redeem_refresh_token(db, raw_token: str, org_id: str | None = None) -> tuple[str, str]:
    """
    Rotate a refresh token. Returns (new_raw_refresh_token, user_id).

    Raises RefreshTokenError / RefreshReuseDetected — routes/auth.py maps
    both to 401. `org_id`, when the caller already knows it, is used only
    to record a reuse-detection evidence entry against the right
    organisation; it grants no authority and is never trusted for anything
    else here.
    """
    settings = get_settings()
    repo = RefreshTokensRepository(db)
    token_hash = hash_token(raw_token)
    doc = await repo.find_by_hash(token_hash)
    if doc is None:
        raise RefreshTokenError("Invalid refresh token.")

    now = datetime.now(timezone.utc)
    if doc["revoked_at"] is not None:
        raise RefreshTokenError("This session has been signed out. Please log in again.")
    if doc["expires_at"] < now:
        raise RefreshTokenError("Refresh token expired. Please log in again.")
    if doc["family_started_at"] + timedelta(days=settings.REFRESH_TOKEN_ABSOLUTE_MAX_DAYS) < now:
        await repo.revoke_family(doc["family_id"], now)
        raise RefreshTokenError("Session too old. Please log in again.")

    claimed = await repo.claim_rotation(token_hash, now)
    if not claimed:
        # Someone already redeemed this exact token — either a genuine
        # race (a retried request) or theft-and-replay. The two cannot be
        # told apart after the fact, so both fail the whole family (see
        # module docstring).
        await repo.revoke_family(doc["family_id"], now)
        log.warning("refresh_reuse_detected family=%s user=%s", doc["family_id"], doc["user_id"])
        if org_id and get_settings().EVIDENCE_ENABLED:
            try:
                await evidence_service.append_entry(
                    db, org_id, user_id=doc["user_id"],
                    event_type="auth_refresh_reuse_detected",
                    payload={"family_id": doc["family_id"]},
                )
            except Exception:
                log.exception("failed to record refresh-reuse evidence entry")
        raise RefreshReuseDetected("Session invalidated for security. Please log in again.")

    new_raw = new_opaque_token(REFRESH_TOKEN_PREFIX)
    await repo.create({
        "_id": hash_token(new_raw),
        "family_id": doc["family_id"],
        "user_id": doc["user_id"],
        "issued_at": now,
        "family_started_at": doc["family_started_at"],
        "expires_at": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "rotated_at": None,
        "revoked_at": None,
    })
    return new_raw, doc["user_id"]


async def revoke_refresh_token(db, raw_token: str) -> None:
    """Logout: revoke the presented token's whole family. Silent no-op for
    an already-invalid token — logout is not the place to leak which
    tokens are live (same oracle-avoidance discipline as forgot-password)."""
    repo = RefreshTokensRepository(db)
    doc = await repo.find_by_hash(hash_token(raw_token))
    if doc is None:
        return
    await repo.revoke_family(doc["family_id"], datetime.now(timezone.utc))


# ─────────────────────────────────────────────────────────────────────
# Device tokens
# ─────────────────────────────────────────────────────────────────────

async def create_device_token(db, *, user_id: str, org_id: str, name: str,
                               scopes: list[str] | None = None) -> tuple[str, dict]:
    """Mint a new device token for `user_id`. Returns (raw_token, stored_doc).
    The raw token is returned to the caller exactly once; only its hash is
    ever stored (see core/tokens.py)."""
    settings = get_settings()
    requested = list(scopes) if scopes else list(DEFAULT_DEVICE_SCOPES)
    unknown = set(requested) - DEVICE_TOKEN_SCOPES
    if unknown:
        raise ValueError(f"Unknown device token scope(s): {sorted(unknown)}")

    now = datetime.now(timezone.utc)
    raw = new_opaque_token(DEVICE_TOKEN_PREFIX)
    doc = {
        "_id": hash_token(raw),
        "user_id": user_id,
        "org_id": org_id,
        "name": (name or "Unnamed device").strip()[:100],
        "scopes": requested,
        "created_at": now,
        "last_used_at": None,
        "expires_at": now + timedelta(days=settings.DEVICE_TOKEN_EXPIRE_DAYS),
        "revoked_at": None,
    }
    await DeviceTokensRepository(db).create(doc)

    if settings.EVIDENCE_ENABLED:
        try:
            await evidence_service.append_entry(
                db, org_id, user_id=user_id, event_type="device_enrolled",
                payload={"device_id": doc["_id"][:16], "name": doc["name"], "scopes": requested},
            )
        except Exception:
            log.exception("failed to record device_enrolled evidence entry")

    return raw, doc


async def verify_device_token(db, raw_token: str, required_scope: str) -> dict:
    """
    Look up, validate, and scope-check a device token. Returns the stored
    document (never the raw token). Raises DeviceTokenError on any failure
    — invalid, expired, revoked, or missing the required scope are
    deliberately not distinguished in the message a caller sees (all
    become a plain 401 at the route layer via core.device_auth); the real
    reason is logged server-side.
    """
    repo = DeviceTokensRepository(db)
    doc = await repo.find_by_hash(hash_token(raw_token))
    now = datetime.now(timezone.utc)

    if doc is None:
        raise DeviceTokenError("Invalid device token.")
    if doc["revoked_at"] is not None:
        log.warning("device_token_revoked_use_attempt device_id=%s", doc["_id"][:16])
        raise DeviceTokenError("This device token has been revoked.")
    if doc["expires_at"] < now:
        raise DeviceTokenError("This device token has expired. Re-enrol the device.")
    if required_scope not in doc.get("scopes", []):
        log.warning("device_token_scope_denied device_id=%s required=%s has=%s",
                    doc["_id"][:16], required_scope, doc.get("scopes"))
        raise DeviceTokenError("This device token is not authorised for that action.")

    await repo.touch_last_used(doc["_id"], now)
    return doc


async def list_device_tokens(db, user_id: str) -> list[dict]:
    return [d async for d in DeviceTokensRepository(db).list_for_user(user_id)]


async def revoke_device_token(db, *, user_id: str, org_id: str, device_id: str) -> bool:
    now = datetime.now(timezone.utc)
    ok = await DeviceTokensRepository(db).revoke(device_id, user_id, now)
    if ok and get_settings().EVIDENCE_ENABLED:
        try:
            await evidence_service.append_entry(
                db, org_id, user_id=user_id, event_type="device_revoked",
                payload={"device_id": device_id[:16]},
            )
        except Exception:
            log.exception("failed to record device_revoked evidence entry")
    return ok
