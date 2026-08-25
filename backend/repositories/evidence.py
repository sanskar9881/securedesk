"""
EvidenceLogRepository — append-only, by construction, not by convention.

The commercial value of the evidence chain is that it cannot be edited
after the fact. That guarantee has to hold even against a future
contributor who "just needs to fix one bad entry" — so this class does not
extend TenantScopedRepository (which has update_one/update_many/delete_one/
delete_many) and override those methods to raise. It composes an internal
scoped repository instead and simply never defines them. There is no
update_one to call, correctly, incorrectly, or accidentally: the method
does not exist on this object.

assert_append_only() (called from main.py's startup) fails loudly if this
class — or EvidenceCheckpointsRepository below — ever grows one of those
method names, so the invariant can't regress silently through a future
edit that adds "just one" mutating method.
"""
from __future__ import annotations

from repositories.base import TenantScopedRepository

_FORBIDDEN_METHODS = ("update_one", "update_many", "delete_one", "delete_many")


class _EvidenceLogScoped(TenantScopedRepository):
    """Private: the real (full-featured) scoped repository, wrapped by
    EvidenceLogRepository below rather than exposed directly — the wrapper
    is what withholds the mutating methods from callers."""
    collection_name = "evidence_log"


class _EvidenceCheckpointsScoped(TenantScopedRepository):
    collection_name = "evidence_checkpoints"


class EvidenceLogRepository:
    collection_name = "evidence_log"

    def __init__(self, db, org_id: str):
        self._scoped = _EvidenceLogScoped(db, org_id)
        self.org_id = org_id
        self.collection = self._scoped.collection

    async def append(self, entry: dict) -> None:
        """The only way a document enters this collection. There is no
        corresponding remove()."""
        await self._scoped.insert_one(entry)

    async def find_one(self, filt: dict | None = None, **kwargs) -> dict | None:
        return await self._scoped.find_one(filt, **kwargs)

    def find_many(self, filt: dict | None = None, **kwargs):
        return self._scoped.find_many(filt, **kwargs)

    async def count(self, filt: dict | None = None, **kwargs) -> int:
        return await self._scoped.count(filt, **kwargs)

    async def aggregate(self, pipeline: list[dict], **kwargs):
        return await self._scoped.aggregate(pipeline, **kwargs)

    async def get_by_seq(self, seq: int) -> dict | None:
        return await self.find_one({"seq": seq})

    async def get_range(self, start_seq: int, end_seq: int):
        """Entries with start_seq <= seq <= end_seq, ascending — the shape
        verify_chain() walks."""
        return self.find_many(
            {"seq": {"$gte": start_seq, "$lte": end_seq}}, sort=[("seq", 1)]
        )


class EvidenceCheckpointsRepository:
    """Same append-only shape as EvidenceLogRepository, for periodic signed
    checkpoints (every 100 entries / daily — see services/evidence_service.py).
    Checkpoints let verification detect truncation: an attacker who deletes
    the tail of the chain also has to explain away the last checkpoint's
    entry count no longer matching."""

    collection_name = "evidence_checkpoints"

    def __init__(self, db, org_id: str):
        self._scoped = _EvidenceCheckpointsScoped(db, org_id)
        self.org_id = org_id
        self.collection = self._scoped.collection

    async def append(self, checkpoint: dict) -> None:
        await self._scoped.insert_one(checkpoint)

    async def latest(self) -> dict | None:
        cursor = self._scoped.find_many({}, sort=[("seq", -1)]).limit(1)
        async for doc in cursor:
            return doc
        return None

    def find_many(self, filt: dict | None = None, **kwargs):
        return self._scoped.find_many(filt, **kwargs)


def assert_append_only() -> None:
    """Fails loudly at startup if evidence_log or evidence_checkpoints ever
    grows an update/delete method. See module docstring."""
    for repo_cls in (EvidenceLogRepository, EvidenceCheckpointsRepository):
        exposed = [m for m in _FORBIDDEN_METHODS if hasattr(repo_cls, m)]
        if exposed:
            raise RuntimeError(
                f"{repo_cls.__name__} exposes mutating method(s) {exposed}. "
                f"{repo_cls.collection_name} must stay append-only — remove "
                f"the method rather than silence this check."
            )
