"""
Shared constants between tenancy_audit.py and migrate_tenancy.py.

Kept as its own module rather than duplicated in each script — the audit's
count of "how many documents are attributable" is only meaningful if it
used the exact same owner-field mapping the migration then acts on. Two
copies of this dict would drift the moment one script changed and the
other didn't.
"""
from __future__ import annotations

# The key holding the owning account id, per collection. The collections
# disagree with each other, so each is named explicitly. `users` is not
# listed: a user document is its own owner.
OWNER_FIELDS: dict[str, str] = {
    "activity_logs":       "user_id",
    "alerts":              "user_id",
    "transactions":        "sender_id",
    "fingerprinted_files": "owner_id",
    "copilot_queries":     "user_id",
    "whatsapp_logs":       "user_id",
    "subscriptions":       "user_id",
    "ip_logs":             "user_id",
    "reset_tokens":        "user_id",
    "chats":               "user_id",
}

# Probed, in order, for any collection not named above.
CANDIDATE_FIELDS: tuple[str, ...] = ("user_id", "sender_id", "owner_id")

# Collections that are not per-tenant data at all, and must never be
# touched by either script: `users` is handled by its own migration step,
# `organizations` is the tenant table being created, `reset_tokens` are
# short-lived bearer credentials already TTL'd out (see core/database.py
# indexes) and carry no product data worth attributing.
EXCLUDED_COLLECTIONS: frozenset[str] = frozenset({
    "users", "organizations", "quarantine_documents",
})

NON_EMPTY = {"$nin": [None, ""]}


async def resolve_owner_field(db, collection_name: str) -> str | None:
    """The owner field for a collection: the declared mapping, or whichever
    candidate field actually holds values, or None if neither applies."""
    field = OWNER_FIELDS.get(collection_name)
    if field:
        return field
    for candidate in CANDIDATE_FIELDS:
        if await db[collection_name].count_documents({candidate: NON_EMPTY}, limit=1):
            return candidate
    return None
