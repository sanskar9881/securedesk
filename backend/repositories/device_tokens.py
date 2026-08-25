"""
DeviceTokensRepository — deliberately NOT tenant-scoped, same reasoning as
RefreshTokensRepository: verifying a bearer device token is a lookup by its
hash, before any org_id is known. org_id is still stored on the document
(the owning user's org at issuance time) purely for audit/evidence purposes
— it is never used as a query filter here.

One document per enrolled device/extension install. See
services/token_service.py for scope semantics and the create/verify/revoke
flow, and core/device_auth.py for how a verified document becomes a
request's authenticated actor.
"""
from __future__ import annotations

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase


class DeviceTokensRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["device_tokens"]

    async def create(self, doc: dict) -> None:
        await self.collection.insert_one(doc)

    async def find_by_hash(self, token_hash: str) -> dict | None:
        return await self.collection.find_one({"_id": token_hash})

    def list_for_user(self, user_id: str):
        return self.collection.find({"user_id": user_id}).sort("created_at", -1)

    def list_for_org(self, org_id: str):
        """Every device across every employee in one organisation — the
        admin-facing view (routes/admin.py), distinct from list_for_user's
        self-service view (routes/device_tokens.py, the extension popup)."""
        return self.collection.find({"org_id": org_id}).sort("created_at", -1)

    async def find_by_id_for_org(self, device_id: str, org_id: str) -> dict | None:
        return await self.collection.find_one({"_id": device_id, "org_id": org_id})

    async def touch_last_used(self, token_hash: str, when: datetime) -> None:
        await self.collection.update_one({"_id": token_hash}, {"$set": {"last_used_at": when}})

    async def revoke(self, device_id: str, user_id: str, revoked_at: datetime) -> bool:
        """device_id IS the token hash — see services/token_service.py.
        Scoped by user_id so one account can never revoke another's device.
        Self-service revoke (routes/device_tokens.py) — see revoke_for_org
        for the admin-initiated equivalent."""
        result = await self.collection.update_one(
            {"_id": device_id, "user_id": user_id, "revoked_at": None},
            {"$set": {"revoked_at": revoked_at}},
        )
        return result.matched_count == 1

    async def revoke_for_org(self, device_id: str, org_id: str, revoked_at: datetime) -> bool:
        """Admin-initiated revoke: scoped by org_id, not by which employee
        owns the device — an admin revokes anyone's device in their own
        organisation, never across a tenant boundary."""
        result = await self.collection.update_one(
            {"_id": device_id, "org_id": org_id, "revoked_at": None},
            {"$set": {"revoked_at": revoked_at}},
        )
        return result.matched_count == 1
