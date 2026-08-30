"""
UsersRepository — the one collection with a documented exception.

Once a caller knows their org_id, every user operation goes through
UsersRepository(db, org_id) like any other tenant-scoped repository.

The exception is identity resolution itself — register, login, loading the
user behind a bearer token, password reset — all of which run before org_id
is known, some of them (login) precisely *because* resolving which org a
person belongs to is what authentication does. That surface is grouped
below as `PreTenantAccounts`, a plain class over a raw `db` handle rather
than a TenantScopedRepository, so it's structurally impossible to construct
it "scoped" and easy to see at a glance that it's the deliberate exception,
not an oversight. Its only caller should be routes/auth.py.

Do not add a new method here for convenience. If a route needs to find a
user without knowing the org first, that route is missing a step (call
get_current_user / get_tenant_id like everything else), not missing a
repository method.
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


class PreTenantAccounts:
    """Identity resolution before org_id exists. See module docstring."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["users"]

    async def find_by_identifier(self, cid: str, raw_identifier: str) -> dict | None:
        """Login lookup: email or phone, across every tenant — that's the point."""
        return await self.collection.find_one({
            "$or": [
                {"email": cid}, {"phone": cid},
                {"email": raw_identifier.lower()}, {"phone": raw_identifier},
            ]
        })

    async def find_by_id(self, user_id: str) -> dict | None:
        """Loading the account behind a bearer token. Org isn't known until
        after this returns — that's what ensure_personal_org resolves next."""
        return await self.collection.find_one({"_id": user_id})

    async def insert(self, doc: dict) -> None:
        await self.collection.insert_one(doc)

    async def set_org_id(self, user_id: str, org_id: str) -> None:
        await self.collection.update_one({"_id": user_id}, {"$set": {"org_id": org_id}})

    async def assign_new_org(self, user_id: str, org_id: str, role: str) -> None:
        """Link an account to the organisation it just created, as its owner.

        One atomic write: the creator of a fresh org is its administrator, so
        org_id and the role are set together (see
        routes/auth.py:ensure_personal_org). Someone who instead JOINS an
        existing org via an invite never reaches here — their org_id is set
        at signup, so ensure_personal_org early-returns and their invited
        role is left alone.
        """
        await self.collection.update_one(
            {"_id": user_id}, {"$set": {"org_id": org_id, "role": role}}
        )

    async def set_password_hash(self, user_id: str, password_hash: str) -> None:
        await self.collection.update_one({"_id": user_id}, {"$set": {"password": password_hash}})

    async def set_auth_provider(self, user_id: str, provider: str) -> None:
        """Record how an account authenticates ("local" | "google").

        Called when an existing email/password account signs in with Google
        for the first time — the two are the same person, so the account is
        linked rather than duplicated. The password hash is left untouched
        so it stays usable as a fallback login path.
        """
        await self.collection.update_one({"_id": user_id}, {"$set": {"auth_provider": provider}})


# Backward-compatible free function — same lookup, old call shape. Kept only
# until any remaining caller is updated to PreTenantAccounts directly.
async def find_by_identifier(db: AsyncIOMotorDatabase, cid: str, raw_identifier: str) -> dict | None:
    return await PreTenantAccounts(db).find_by_identifier(cid, raw_identifier)
