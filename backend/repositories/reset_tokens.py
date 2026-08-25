"""
ResetTokensRepository — deliberately NOT tenant-scoped.

A reset token is a bearer credential looked up by the token itself, not by
org — the whole point is that the caller presenting it hasn't authenticated
yet. Short-lived (see the TTL index in core/database.py) and never exposed
outside routes/auth.py.
"""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase


class ResetTokensRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["reset_tokens"]

    async def create(self, doc: dict) -> None:
        await self.collection.insert_one(doc)

    async def find_unused(self, token: str) -> dict | None:
        return await self.collection.find_one({"_id": token, "used": False})

    async def mark_used(self, token: str) -> None:
        await self.collection.update_one({"_id": token}, {"$set": {"used": True}})
