"""
Shared fixtures for the backend test suite.

Runs against a real local MongoDB rather than a mock: Motor's cursor,
aggregation, and upsert semantics are exactly what the isolation guarantee
depends on, and a mock is a second implementation of that behavior that can
drift from the real driver. The database name is fixed and distinct from
dev/prod ("securedesk_test") and every test cleans up its own collections,
so this is safe to run against the same MongoDB instance used for local
development.
"""
from __future__ import annotations

import os

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

TEST_DB_NAME = "securedesk_test"


@pytest.fixture(scope="session")
def event_loop_policy():
    import asyncio
    return asyncio.DefaultEventLoopPolicy()


@pytest_asyncio.fixture
async def test_db():
    url = os.environ.get("TEST_MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(url, tz_aware=True)
    db = client[TEST_DB_NAME]
    try:
        yield db
    finally:
        # Full teardown, not per-collection: leaves no residue between runs
        # even if a test adds a collection this fixture doesn't know about.
        await client.drop_database(TEST_DB_NAME)
        client.close()
