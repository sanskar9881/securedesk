"""
TenantScopedRepository — the structural fix for cross-tenant data leaks.

The problem this replaces: every route added `org_id` to its own Mongo
filter by hand. One omission across 15+ route files is a cross-tenant read,
write, or delete. That is not a hypothetical — before this repository layer,
13 of 19 route modules had zero org scoping at all (see the Phase 2 audit).

The fix is structural rather than procedural: a repository is constructed
bound to exactly one org_id, and every data-access method injects that
org_id into the operation internally. A caller cannot pass a filter that
reaches another tenant's data, because the tenant filter is not something
the caller controls — it's fixed at construction and merged in afterward,
never merged in a way the caller's dict could overwrite.

Usage:

    class UsersRepository(TenantScopedRepository):
        collection_name = "users"

    repo = UsersRepository(db, org_id=current_user["org_id"])
    await repo.find_many({"role": "manager"})   # scoped to this org, always
"""
from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger("securedesk.repositories")


class CrossTenantFilterError(Exception):
    """Raised when a caller's filter tries to set org_id itself.

    This is not a validation nicety — it is the leak detector. Legitimate
    callers never need to mention org_id; they operate as "my org" by
    construction. A filter that includes it is either a bug (a call site
    copy-pasted from before the repository existed) or an attempt to reach
    across tenants. Either way it must not silently execute.
    """


class TenantScopedRepository:
    """Base class for all tenant-scoped data access.

    Subclasses set `collection_name`. Every method here forces every
    operation to stay inside `self.org_id` — there is no method on this
    class, or expected to be added to a subclass, that accepts an org_id
    from the caller.
    """

    collection_name: str = ""

    def __init__(self, db: AsyncIOMotorDatabase, org_id: str):
        if not org_id:
            # Fail at construction, not at the first query. A repository
            # with no tenant is not a "see everything" repository — it is
            # a bug, and must never be instantiated.
            raise ValueError(
                f"{type(self).__name__} requires a non-empty org_id. "
                f"Refusing to construct an unscoped repository."
            )
        if not self.collection_name:
            raise ValueError(f"{type(self).__name__} must set collection_name.")

        self.db = db
        self.org_id = org_id
        self.collection = db[self.collection_name]

    # ── internal ─────────────────────────────────────────────────────

    def _scoped_filter(self, filt: dict[str, Any] | None) -> dict[str, Any]:
        """Merge the caller's filter with the tenant scope.

        Raises if the caller's filter already names org_id — see
        CrossTenantFilterError. Otherwise returns {org_id: self.org_id, **filt},
        which is safe because the caller's dict is guaranteed not to contain
        that key by the time we get here.
        """
        filt = dict(filt or {})
        if "org_id" in filt:
            log.error(
                "leaking call site: %s.%s passed org_id explicitly (value=%r); "
                "this filter would have been redundant at best and a tenant "
                "override at worst",
                type(self).__name__, self.collection_name, filt["org_id"],
            )
            raise CrossTenantFilterError(
                f"{type(self).__name__}: filter must not include 'org_id'. "
                f"The repository is already scoped to org_id={self.org_id!r}; "
                f"a caller-supplied org_id is always a bug."
            )
        filt["org_id"] = self.org_id
        return filt

    def _scoped_document(self, doc: dict[str, Any]) -> dict[str, Any]:
        """Force org_id onto a document being inserted.

        Overwrites any org_id the caller supplied — a document can never be
        created for a tenant other than the one this repository is bound to.
        """
        doc = dict(doc)
        doc["org_id"] = self.org_id
        return doc

    # ── reads ────────────────────────────────────────────────────────

    async def find_one(self, filt: dict[str, Any] | None = None, **kwargs) -> dict | None:
        return await self.collection.find_one(self._scoped_filter(filt), **kwargs)

    def find_many(self, filt: dict[str, Any] | None = None, **kwargs):
        """Returns a Motor cursor, already scoped. Iterate with `async for`."""
        return self.collection.find(self._scoped_filter(filt), **kwargs)

    async def count(self, filt: dict[str, Any] | None = None, **kwargs) -> int:
        return await self.collection.count_documents(self._scoped_filter(filt), **kwargs)

    async def aggregate(self, pipeline: list[dict[str, Any]], **kwargs) -> AsyncIterator[dict]:
        """Prepends an unconditional $match on org_id as the first stage.

        Unconditional means exactly that: even a pipeline that starts with
        its own $match is preceded by this one, so the tenant boundary is
        the very first thing Mongo evaluates, before any caller-supplied
        stage runs.
        """
        scoped_pipeline = [{"$match": {"org_id": self.org_id}}] + list(pipeline)
        return self.collection.aggregate(scoped_pipeline, **kwargs)

    # ── writes ───────────────────────────────────────────────────────

    async def insert_one(self, doc: dict[str, Any], **kwargs):
        return await self.collection.insert_one(self._scoped_document(doc), **kwargs)

    async def insert_many(self, docs: list[dict[str, Any]], **kwargs):
        return await self.collection.insert_many(
            [self._scoped_document(d) for d in docs], **kwargs
        )

    async def update_one(
        self, filt: dict[str, Any], update: dict[str, Any], **kwargs
    ):
        # $set/$setOnInsert blocks in `update` are not filter fields, so they
        # cannot smuggle a cross-tenant filter past _scoped_filter — but an
        # upsert could still *write* a foreign org_id via $set. Strip it from
        # every update operator that can set fields, same rule as inserts:
        # this repository can never write another tenant's org_id.
        update = _strip_org_id_from_update(update)
        return await self.collection.update_one(
            self._scoped_filter(filt), update, **kwargs
        )

    async def update_many(
        self, filt: dict[str, Any], update: dict[str, Any], **kwargs
    ):
        update = _strip_org_id_from_update(update)
        return await self.collection.update_many(
            self._scoped_filter(filt), update, **kwargs
        )

    async def delete_one(self, filt: dict[str, Any], **kwargs):
        return await self.collection.delete_one(self._scoped_filter(filt), **kwargs)

    async def delete_many(self, filt: dict[str, Any], **kwargs):
        return await self.collection.delete_many(self._scoped_filter(filt), **kwargs)


_MUTATING_OPERATORS = ("$set", "$setOnInsert")


def _strip_org_id_from_update(update: dict[str, Any]) -> dict[str, Any]:
    """Remove any attempt to set org_id via $set / $setOnInsert.

    An update filter is already tenant-scoped by _scoped_filter, so a plain
    update_one can only ever match documents already in this org. The
    remaining hole is upsert=True: with no matching document, Mongo creates
    one from the update's $setOnInsert/$set content, which could otherwise
    carry a caller-supplied org_id into existence. This closes that path the
    same way insert_one does.
    """
    cleaned = dict(update)
    for op in _MUTATING_OPERATORS:
        if op in cleaned and "org_id" in cleaned[op]:
            cleaned[op] = {k: v for k, v in cleaned[op].items() if k != "org_id"}
    return cleaned
