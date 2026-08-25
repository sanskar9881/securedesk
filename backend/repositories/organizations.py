"""
OrganizationsRepository — deliberately NOT tenant-scoped.

Every other repository in this package extends TenantScopedRepository
because its documents belong to exactly one tenant. `organizations` is
different: its documents *are* the tenants. There is no org_id to scope by
— an organization's own _id is the tenant identifier everything else scopes
against. Forcing this collection through TenantScopedRepository would be
circular.

This repository is therefore the one place in the data-access layer that
can see across the whole collection, and it's kept deliberately small: look
up an org by id, create one, list/count by owner. It must never grow a
method that returns org documents filtered by anything other than an
explicit id or owner_id the caller already had a right to know — that would
recreate the cross-tenant leak this whole layer exists to prevent.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


class OrganizationsRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["organizations"]

    async def get(self, org_id: str) -> dict | None:
        return await self.collection.find_one({"_id": org_id})

    async def create(self, org_id: str, name: str, owner_id: str, **extra: Any) -> dict:
        doc = {
            "_id": org_id,
            "name": name,
            "owner_id": owner_id,
            "created_at": datetime.now(timezone.utc),
            "plan": "trial",
            **extra,
        }
        await self.collection.insert_one(doc)
        return doc

    async def exists(self, org_id: str) -> bool:
        return await self.collection.count_documents({"_id": org_id}, limit=1) > 0

    async def count(self) -> int:
        return await self.collection.count_documents({})

    async def domain_taken_by_another(self, domain: str, org_id: str) -> bool:
        """True if some *other* organisation already owns this domain."""
        return await self.collection.count_documents(
            {"domain": domain, "_id": {"$ne": org_id}}, limit=1
        ) > 0

    async def update_profile(self, org_id: str, **fields: Any) -> None:
        """Update an organisation's own descriptive fields (name, domain,
        industry, size, ...). Callers pass only the fields they own the
        right to change — this does not accept org_id or _id."""
        fields.pop("org_id", None)
        fields.pop("_id", None)
        if fields:
            await self.collection.update_one({"_id": org_id}, {"$set": fields})
