"""
DEPRECATED — kept only so existing imports keep working.

The connection now lives in `core/database.py`, created in the FastAPI
lifespan rather than as an import-time side effect. This module re-exports
the same names it always did, as lazy proxies that resolve on first use.

New code must not import from here. Use the dependency in routes:

    from core.database import get_db
    async def handler(db = Depends(get_db)): ...

or the accessor in services and scripts:

    from core.database import get_database

Phase 2 replaces every call site below with a repository, after which this
module is deleted.
"""
from __future__ import annotations

from core.database import db

users_collection        = db["users"]
transactions_collection = db["transactions"]
reset_tokens_collection = db["reset_tokens"]
fingerprints_collection = db["fingerprinted_files"]
activity_collection     = db["activity_logs"]
alerts_collection       = db["alerts"]

__all__ = [
    "db",
    "users_collection",
    "transactions_collection",
    "reset_tokens_collection",
    "fingerprints_collection",
    "activity_collection",
    "alerts_collection",
]
