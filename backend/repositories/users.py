"""
UsersRepository — the one collection with a documented exception.

Once a caller knows their org_id, every user operation goes through
UsersRepository(db, org_id) like any other tenant-scoped repository.

The exception is login itself: at that point in the request, the org_id is
unknown — resolving *which* org a person belongs to is exactly what
authentication does, by looking them up by email or phone across every
tenant. That single lookup is inherently pre-tenant and cannot be scoped.
It is pulled out as `find_by_identifier`, a module-level function taking a
raw `db` handle rather than a repository method, specifically so it cannot
be reached by calling a method on a scoped instance — the only caller of
this function should ever be the authentication path in routes/auth.py.

Do not add a second unscoped lookup to this module for convenience. If a
route needs to find a user without knowing the org first, that route is
missing a step, not missing a repository method.
"""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from repositories.base import TenantScopedRepository


class UsersRepository(TenantScopedRepository):
    collection_name = "users"

    async def get(self, user_id: str) -> dict | None:
        return await self.find_one({"_id": user_id})

    async def list_by_role(self, role: str):
        return self.find_many({"role": role})

    async def set_role(self, user_id: str, role: str) -> bool:
        result = await self.update_one({"_id": user_id}, {"$set": {"role": role}})
        return result.modified_count > 0


async def find_by_identifier(db: AsyncIOMotorDatabase, cid: str, raw_identifier: str) -> dict | None:
    """Pre-tenant lookup for authentication only. See module docstring."""
    return await db["users"].find_one({
        "$or": [
            {"email": cid}, {"phone": cid},
            {"email": raw_identifier.lower()}, {"phone": raw_identifier},
        ]
    })
