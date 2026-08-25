"""
The MongoDB connection.

One AsyncIOMotorClient for the process, created when the app starts and
closed when it stops. Nothing else in the codebase may construct a client.

Why this exists: `database.py` used to build a client at import time, as a
module-level side effect. That meant DNS resolution and TLS setup happened
while Python was still importing modules, before the app could report a
problem sensibly; a bad URI surfaced as an import traceback rather than a
startup error. It also gave the test suite no way to point at a different
database, and no shutdown path at all — connections were dropped rather
than closed.

Access patterns, in order of preference:

    # in a route — the dependency
    async def handler(db = Depends(get_db)): ...

    # in a service or script — the accessor
    from core.database import get_database
    db = get_database()

The lazy proxies at the bottom exist only to keep the pre-existing
`from database import users_collection` call sites working while they are
migrated to repositories in Phase 2. Do not use them in new code.
"""
from __future__ import annotations

import logging
from datetime import timezone
from typing import Any

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from core.config import get_settings

log = logging.getLogger("securedesk.db")

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


# ─────────────────────────────────────────────────────────────────────
# Lifecycle
# ─────────────────────────────────────────────────────────────────────

def _build_client(url: str) -> AsyncIOMotorClient:
    """Construct the driver client with certificate verification on.

    tlsCAFile is pinned to the certifi bundle because the system trust
    store is what is typically missing — Render's slim Python image and
    stock macOS both lack the roots Atlas presents. That absence is what
    tlsAllowInvalidCertificates=True used to paper over, disabling
    verification entirely. TLS without verification is not TLS.

    tz_aware=True and tzinfo=timezone.utc make the driver hand back
    timezone-aware datetimes on every read, not just accept them on write.
    BSON always stores UTC; PyMongo's default is to decode it back as a
    *naive* datetime, silently stripping the tzinfo. Without this, storing
    `datetime.now(timezone.utc)` would still round-trip into a naive value,
    and the first comparison against a fresh aware datetime elsewhere in
    the app — e.g. an expiry check — would raise TypeError. This is what
    makes invariant #4 (all timestamps UTC, timezone-aware) hold all the
    way through a read, not just at the point of writing.
    """
    if "mongodb+srv" in url or "mongodb.net" in url:
        return AsyncIOMotorClient(
            url,
            tls=True,
            tlsCAFile=certifi.where(),
            tz_aware=True,
            tzinfo=timezone.utc,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
        )
    return AsyncIOMotorClient(url, tz_aware=True, tzinfo=timezone.utc)


async def connect() -> AsyncIOMotorDatabase:
    """Open the connection and ensure indexes. Called from the app lifespan."""
    global _client, _database

    if _client is not None:
        return _database  # type: ignore[return-value]

    settings = get_settings()
    _client = _build_client(settings.MONGODB_URL)
    _database = _client[settings.DATABASE_NAME]

    host = settings.MONGODB_URL.split("@")[-1].split("/")[0]
    log.info("connected to mongodb db=%s host=%s", settings.DATABASE_NAME, host)

    await ensure_indexes(_database)
    return _database


async def disconnect() -> None:
    """Close the connection. Called from the app lifespan on shutdown."""
    global _client, _database
    if _client is not None:
        _client.close()
        log.info("mongodb connection closed")
    _client = None
    _database = None


def get_database() -> AsyncIOMotorDatabase:
    """The database handle. Raises if called before the app started."""
    if _database is None:
        raise RuntimeError(
            "Database is not connected. get_database() was called outside the "
            "application lifespan — in a script, call core.database.connect() first."
        )
    return _database


async def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency: `db = Depends(get_db)`."""
    return get_database()


# ─────────────────────────────────────────────────────────────────────
# Indexes
# ─────────────────────────────────────────────────────────────────────

# Every index the query patterns in routes/ and services/ actually need.
# create_index is idempotent: re-issuing an identical spec is a no-op, so
# this runs safely on every boot.
#
# Deliberately none of these are unique. `users` stores email="" for
# phone-registered accounts and phone="" for email-registered ones, so a
# unique index on either would collide across every account sharing the
# empty string. Making them unique needs a partial filter plus a dedupe
# migration — that belongs with the Phase 2 tenancy work, not here.
INDEXES: dict[str, list[tuple[list[tuple[str, int]], dict[str, Any]]]] = {
    "users": [
        ([("email", 1)], {"name": "email_idx"}),
        ([("phone", 1)], {"name": "phone_idx"}),
        ([("org_id", 1)], {"name": "org_idx"}),
        ([("org_id", 1), ("role", 1)], {"name": "org_role_idx"}),
    ],
    "transactions": [
        ([("sender_id", 1), ("timestamp", -1)], {"name": "sender_time_idx"}),
        ([("timestamp", -1)], {"name": "time_idx"}),
        ([("classification", 1)], {"name": "classification_idx"}),
        ([("severity", 1)], {"name": "severity_idx"}),
    ],
    "activity_logs": [
        ([("user_id", 1), ("timestamp", -1)], {"name": "user_time_idx"}),
        ([("org_id", 1), ("timestamp", -1)], {"name": "org_time_idx"}),
    ],
    "alerts": [
        ([("user_id", 1), ("timestamp", -1)], {"name": "user_time_idx"}),
        ([("org_id", 1), ("timestamp", -1)], {"name": "org_time_idx"}),
    ],
    "fingerprinted_files": [
        ([("owner_id", 1)], {"name": "owner_idx"}),
        # Compound and unique per (org_id, hash), not on hash alone: the
        # document's _id is now a fresh uuid (see services/file_service.py),
        # since a bare content-hash _id would collide the moment two
        # different organisations uploaded byte-identical files — Mongo's
        # _id uniqueness is collection-wide, not per-tenant.
        ([("org_id", 1), ("hash", 1)], {"name": "org_hash_unique_idx", "unique": True}),
    ],
    "whatsapp_logs": [
        ([("user_id", 1), ("timestamp", -1)], {"name": "user_time_idx"}),
    ],
    "organizations": [
        ([("owner_id", 1)], {"name": "owner_idx"}),
    ],
    "invitations": [
        ([("org_id", 1)], {"name": "org_idx"}),
    ],
    "subscriptions": [
        ([("user_id", 1)], {"name": "user_idx"}),
    ],
    # Evidence chain (Phase 3). evidence_log has no update/delete path in
    # code (see repositories/evidence.py) — org_seq_unique_idx additionally
    # makes a duplicate seq within one org's chain a database-level
    # impossibility, not just an application-level one.
    "evidence_log": [
        ([("org_id", 1), ("seq", 1)], {"name": "org_seq_unique_idx", "unique": True}),
        ([("org_id", 1), ("user_id", 1), ("timestamp", -1)], {"name": "org_user_time_idx"}),
        ([("org_id", 1), ("event_type", 1)], {"name": "org_event_type_idx"}),
        ([("retain_until", 1)], {"name": "retain_until_idx"}),
    ],
    "evidence_chain_heads": [
        # _id is already org_id (one head document per org) — no extra
        # index needed beyond the implicit _id index.
    ],
    "evidence_checkpoints": [
        ([("org_id", 1), ("seq", 1)], {"name": "org_seq_idx"}),
    ],
    # TTL: expired reset tokens delete themselves. They are bearer
    # credentials for an account, so they should not outlive their window
    # sitting in the collection.
    "reset_tokens": [
        ([("expires_at", 1)], {"name": "expiry_ttl_idx", "expireAfterSeconds": 0}),
        ([("user_id", 1)], {"name": "user_idx"}),
    ],
}


# Index names retired by a later spec change, dropped on startup before the
# current INDEXES are created. Superseded by org_hash_unique_idx: the old
# hash_idx was non-unique and scoped to hash alone, which would have allowed
# two organisations' fingerprint documents to collide — see the comment on
# org_hash_unique_idx above.
_RETIRED_INDEXES: dict[str, list[str]] = {
    "fingerprinted_files": ["hash_idx"],
}


async def ensure_indexes(database: AsyncIOMotorDatabase) -> None:
    """Create every declared index. Idempotent; safe on every boot.

    A failure here is logged rather than raised: an index problem should
    degrade query performance, not take the whole service down. Phase 7's
    /ready endpoint is what will report the connection as unhealthy.
    """
    for collection, names in _RETIRED_INDEXES.items():
        for name in names:
            try:
                await database[collection].drop_index(name)
                log.info("dropped retired index %s on %s", name, collection)
            except Exception:
                pass  # already gone — the common case after the first boot

    created = 0
    for collection, specs in INDEXES.items():
        for keys, options in specs:
            try:
                await database[collection].create_index(keys, **options)
                created += 1
            except Exception as exc:  # pragma: no cover - driver/server specific
                log.warning(
                    "index %s on %s could not be created: %s",
                    options.get("name", keys), collection, exc,
                )
    log.info("ensured %d indexes across %d collections", created, len(INDEXES))


# ─────────────────────────────────────────────────────────────────────
# Backward-compatible lazy handles
# ─────────────────────────────────────────────────────────────────────
#
# Roughly twenty modules do `from database import users_collection` at
# import time, and two dozen do `col = db["name"]` at module level. Both
# run before the app has started, so they cannot hold a real collection.
#
# These proxies resolve to the real collection on first attribute access,
# which happens inside a request — by which point the lifespan has run.
# They are a migration aid with a definite end: Phase 2 replaces every one
# of those call sites with a repository, and then this section is deleted.

class _CollectionProxy:
    """Defers `database[name]` until the attribute is actually used."""

    __slots__ = ("_name",)

    def __init__(self, name: str) -> None:
        self._name = name

    def _resolve(self):
        return get_database()[self._name]

    def __getattr__(self, item: str) -> Any:
        return getattr(self._resolve(), item)

    def __getitem__(self, item: str) -> Any:
        return self._resolve()[item]

    def __repr__(self) -> str:
        return f"<lazy collection {self._name!r}>"


class _DatabaseProxy:
    """Defers the database handle, and hands out lazy collections."""

    def __getitem__(self, name: str) -> _CollectionProxy:
        return _CollectionProxy(name)

    def __getattr__(self, item: str) -> Any:
        return getattr(get_database(), item)

    def __repr__(self) -> str:
        return "<lazy database>"


db = _DatabaseProxy()
