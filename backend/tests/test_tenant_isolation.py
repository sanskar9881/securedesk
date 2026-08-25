"""
Phase 2 regression test: a repository bound to org A cannot read, update,
delete, count, or aggregate anything belonging to org B.

Per the Phase 2 spec: "This test must exist before this phase is
considered complete." It seeds two organisations with real data through
TenantScopedRepository itself (not by inserting cross-tenant fixtures by
hand — org A's repository is the thing under test, so it also has to be
what creates org A's data), then asserts the isolation boundary holds
across every method the base class exposes.

A generic Probe repository is used instead of a concrete one (UsersRepository
etc.) because this test is about the base class's guarantee, which every
subclass inherits unchanged. Concrete repositories get their own
collection-specific tests; this one is what has to hold no matter how many
of those there are.
"""
from __future__ import annotations

import pytest

from repositories.base import CrossTenantFilterError, TenantScopedRepository

ORG_A = "org-tenant-test-A"
ORG_B = "org-tenant-test-B"


class Probe(TenantScopedRepository):
    collection_name = "__tenant_isolation_probe"


@pytest.fixture
async def repos(test_db):
    a = Probe(test_db, org_id=ORG_A)
    b = Probe(test_db, org_id=ORG_B)
    await a.insert_one({"_id": "a-doc-1", "label": "A's first"})
    await a.insert_one({"_id": "a-doc-2", "label": "A's second"})
    await b.insert_one({"_id": "b-doc-1", "label": "B's only"})
    return a, b


async def test_construction_rejects_empty_org_id(test_db):
    with pytest.raises(ValueError):
        Probe(test_db, org_id="")
    with pytest.raises(ValueError):
        Probe(test_db, org_id=None)


async def test_insert_forces_org_id_ignoring_caller_value(test_db):
    a = Probe(test_db, org_id=ORG_A)
    await a.insert_one({"_id": "spoof-1", "org_id": ORG_B})
    doc = await test_db["__tenant_isolation_probe"].find_one({"_id": "spoof-1"})
    assert doc["org_id"] == ORG_A


async def test_find_one_cannot_read_across_tenants(repos):
    a, b = repos
    assert await a.find_one({"_id": "b-doc-1"}) is None
    assert await b.find_one({"_id": "a-doc-1"}) is None
    # sanity: each org can read its own
    assert (await a.find_one({"_id": "a-doc-1"}))["label"] == "A's first"


async def test_find_many_never_returns_foreign_documents(repos):
    a, b = repos
    a_ids = {d["_id"] async for d in a.find_many({})}
    b_ids = {d["_id"] async for d in b.find_many({})}
    assert a_ids == {"a-doc-1", "a-doc-2"}
    assert b_ids == {"b-doc-1"}
    assert a_ids.isdisjoint(b_ids)


async def test_count_is_scoped(repos):
    a, b = repos
    assert await a.count({}) == 2
    assert await b.count({}) == 1


async def test_update_one_cannot_modify_foreign_document(repos):
    a, b = repos
    result = await a.update_one({"_id": "b-doc-1"}, {"$set": {"label": "pwned"}})
    assert result.matched_count == 0
    untouched = await b.find_one({"_id": "b-doc-1"})
    assert untouched["label"] == "B's only"


async def test_update_many_cannot_modify_foreign_documents(repos):
    a, b = repos
    result = await a.update_many({}, {"$set": {"label": "pwned"}})
    assert result.matched_count == 2  # only A's own two documents
    untouched = await b.find_one({"_id": "b-doc-1"})
    assert untouched["label"] == "B's only"


async def test_upsert_cannot_smuggle_a_foreign_org_id(test_db):
    a = Probe(test_db, org_id=ORG_A)
    await a.update_one(
        {"_id": "upserted-1"},
        {"$set": {"label": "created via upsert", "org_id": ORG_B}},
        upsert=True,
    )
    created = await test_db["__tenant_isolation_probe"].find_one({"_id": "upserted-1"})
    assert created["org_id"] == ORG_A


async def test_delete_one_cannot_remove_foreign_document(repos):
    a, b = repos
    result = await a.delete_one({"_id": "b-doc-1"})
    assert result.deleted_count == 0
    assert await b.find_one({"_id": "b-doc-1"}) is not None


async def test_delete_many_only_removes_own_tenant(repos):
    a, b = repos
    result = await a.delete_many({})
    assert result.deleted_count == 2
    assert await b.find_one({"_id": "b-doc-1"}) is not None


async def test_aggregate_prepends_tenant_match_unconditionally(repos):
    a, b = repos
    # A pipeline that starts with its own $match must not widen the scope —
    # the org $match is prepended before it, not merged with it.
    pipeline = [{"$match": {"label": {"$exists": True}}}]
    cursor = await a.aggregate(pipeline)
    ids = {d["_id"] async for d in cursor}
    assert ids == {"a-doc-1", "a-doc-2"}


async def test_aggregate_cannot_be_used_to_read_across_tenants(repos):
    a, b = repos
    # Even a pipeline with no filter at all — the widest possible ask —
    # is still bounded by the prepended $match.
    cursor = await a.aggregate([])
    ids = {d["_id"] async for d in cursor}
    assert "b-doc-1" not in ids


async def test_explicit_org_id_in_filter_is_rejected_not_ignored(repos):
    """
    A filter naming org_id is refused outright rather than silently merged
    or silently overridden — either behavior could mask a caller that
    thought it was choosing a tenant. See CrossTenantFilterError's docstring.
    """
    a, b = repos
    with pytest.raises(CrossTenantFilterError):
        await a.find_one({"org_id": ORG_B})
    with pytest.raises(CrossTenantFilterError):
        await a.find_many({"org_id": ORG_B}).to_list(length=10)
    with pytest.raises(CrossTenantFilterError):
        await a.count({"org_id": ORG_B})
    with pytest.raises(CrossTenantFilterError):
        await a.update_one({"org_id": ORG_B}, {"$set": {"label": "x"}})
    with pytest.raises(CrossTenantFilterError):
        await a.delete_one({"org_id": ORG_B})
