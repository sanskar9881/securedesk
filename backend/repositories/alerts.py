"""AlertsRepository — security alerts (HIGH-risk events, UEBA anomalies)."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class AlertsRepository(TenantScopedRepository):
    collection_name = "alerts"
