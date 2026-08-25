"""TransactionsRepository — file-send / phishing-check log, tenant-scoped."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class TransactionsRepository(TenantScopedRepository):
    collection_name = "transactions"
