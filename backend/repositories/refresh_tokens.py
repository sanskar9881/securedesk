"""
RefreshTokensRepository — deliberately NOT tenant-scoped.

Same reasoning as ResetTokensRepository: a refresh token is a bearer
credential looked up by its own hash, by a caller who hasn't presented an
org_id (or any other authenticated context) yet — that lookup IS the
authentication. See core/tokens.py for why only the hash is ever stored,
and services/token_service.py for the rotation/reuse-detection state
machine this repository stores state for.

Document shape (one per *generation* within a rotation family):

    _id                 sha256 hex of the raw refresh token (never the raw
                         token itself)
    family_id           uuid, constant across every rotation of one login
                         session
    user_id
    issued_at            when this generation was minted
    family_started_at    issued_at of generation #0 — enforces the absolute
                          family lifetime cap regardless of how often it is
                          rotated (see token_service.
                          REFRESH_TOKEN_ABSOLUTE_MAX_DAYS)
    expires_at           TTL — this generation stops being redeemable
    rotated_at           set the moment this generation is redeemed; a
                          second redemption attempt after this is set is
                          reuse (see token_service.redeem_refresh_token)
    revoked_at           set on logout or on reuse detection (revokes the
                          whole family, not just this generation)
"""
from __future__ import annotations

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase


class RefreshTokensRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["refresh_tokens"]

    async def create(self, doc: dict) -> None:
        await self.collection.insert_one(doc)

    async def find_by_hash(self, token_hash: str) -> dict | None:
        return await self.collection.find_one({"_id": token_hash})

    async def claim_rotation(self, token_hash: str, rotated_at: datetime) -> bool:
        """
        Mark this generation as redeemed — the CAS that makes reuse
        detection race-safe. Two concurrent requests presenting the same
        refresh token can both reach this call; the filter's
        `rotated_at: None, revoked_at: None` means only the first can
        possibly match, so only one ever proceeds to mint a successor. The
        loser sees matched_count == 0 and is treated as reuse, exactly like
        a genuinely stolen-and-replayed token would be — a live race and a
        delayed replay look identical here, and both must fail closed.
        """
        result = await self.collection.update_one(
            {"_id": token_hash, "rotated_at": None, "revoked_at": None},
            {"$set": {"rotated_at": rotated_at}},
        )
        return result.matched_count == 1

    async def revoke_family(self, family_id: str, revoked_at: datetime) -> int:
        result = await self.collection.update_many(
            {"family_id": family_id, "revoked_at": None},
            {"$set": {"revoked_at": revoked_at}},
        )
        return result.modified_count
