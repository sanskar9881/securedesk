"""
InvitationsRepository — pending role-assigned invites to an organisation.

An invite is created by an admin (POST /api/admin/invite) against their own
org, and consumed once, unauthenticated, when the invited person signs up
(POST /api/auth/register or /api/auth/google with an `invite` token). Its
whole job is to carry one fact the public signup path is otherwise forbidden
to accept: which org the new account joins, and with which role.

Two access shapes, mirroring repositories/users.py:

    InvitationsRepository(db, org_id)  — the admin side. Tenant-scoped like
        every other repository: an admin only ever sees or revokes invites
        belonging to their own organisation.

    PendingInvites(db)                 — the signup side. A plain lookup by
        the opaque token, because the caller presenting it has not
        authenticated and no org_id is known yet (the invite is what
        supplies it). Its only caller is routes/auth.py.

The token is the document _id (a uuid4 hex), so it is looked up directly
with no secondary index, same as reset_tokens. A TTL index on `expires_at`
(see core/database.py) clears spent and stale invites on its own.
"""
from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from repositories.base import TenantScopedRepository


class InvitationsRepository(TenantScopedRepository):
    collection_name = "invitations"

    async def create(self, doc: dict) -> None:
        await self.insert_one(doc)

    async def list_pending(self) -> list[dict]:
        cursor = self.find_many({"accepted": False}, sort=[("created_at", -1)])
        return [d async for d in cursor]

    async def get(self, token: str) -> dict | None:
        return await self.find_one({"_id": token})

    async def revoke(self, token: str) -> bool:
        result = await self.delete_one({"_id": token})
        return result.deleted_count > 0

    async def find_active_for_email(self, email: str) -> dict | None:
        return await self.find_one({"email": email.lower(), "accepted": False})


class PendingInvites:
    """Token lookup before org_id exists. See module docstring."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["invitations"]

    async def find_valid(self, token: str) -> dict | None:
        """The invite for `token` if it exists, is unspent, and is unexpired.

        Returns None for every failure mode with no distinction between them
        — the signup path turns any None into one generic "invalid or
        expired" message rather than an oracle for which tokens exist.
        """
        doc = await self.collection.find_one({"_id": token, "accepted": False})
        if not doc:
            return None
        expires_at = doc.get("expires_at")
        if expires_at and expires_at < datetime.now(timezone.utc):
            return None
        return doc

    async def mark_accepted(self, token: str) -> None:
        await self.collection.update_one(
            {"_id": token},
            {"$set": {"accepted": True, "accepted_at": datetime.now(timezone.utc)}},
        )
