"""IPLogsRepository — per-login IP address audit trail."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class IPLogsRepository(TenantScopedRepository):
    collection_name = "ip_logs"
