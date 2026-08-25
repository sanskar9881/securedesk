"""
EvidenceChainHeadsRepository — one document per organisation, tracking the
tip of that org's evidence chain.

Unlike evidence_log, this collection legitimately needs updates: the head
document's seq/head_hash/signature advance every time a new entry is
appended. What makes concurrent appends safe without a distributed lock is
optimistic concurrency (compare-and-swap): advance() only succeeds if the
document still shows the seq the caller last read. Two requests racing to
append entry #47 both read seq=46, both try to CAS from 46->47; exactly one
update matches and wins, the loser's caller (services/evidence_service.py)
re-reads the new head and retries with seq=48.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from repositories.base import TenantScopedRepository


class EvidenceChainHeadsRepository(TenantScopedRepository):
    collection_name = "evidence_chain_heads"

    async def get_head(self) -> dict | None:
        """The org's current chain head, or None if the chain doesn't exist yet."""
        return await self.find_one({})

    async def create_genesis(self, seq: int, head_hash: str, signature: str) -> bool:
        """
        Create the head document for a chain's first entry.

        Returns True if this call created it. Returns False (not an
        exception) if a concurrent request already created it — Mongo's
        unique _id enforces that only one insert can win; the loser
        re-reads the now-existing head and proceeds from there rather than
        treating the race as an error.
        """
        try:
            await self.insert_one({
                "_id": self.org_id,
                "seq": seq,
                "head_hash": head_hash,
                "signature": signature,
                "updated_at": datetime.now(timezone.utc),
            })
            return True
        except Exception:
            # Duplicate key — someone else created the genesis head first.
            return False

    async def advance(
        self, *, expected_seq: int, new_seq: int, new_head_hash: str, signature: str,
    ) -> bool:
        """
        Compare-and-swap the head forward by exactly one entry.

        Returns True if this call won the race (the document still showed
        expected_seq), False if someone else advanced it first — the
        caller re-reads get_head() and retries with the new numbers.
        """
        result = await self.update_one(
            {"seq": expected_seq},
            {"$set": {
                "seq": new_seq,
                "head_hash": new_head_hash,
                "signature": signature,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        return result.matched_count == 1
