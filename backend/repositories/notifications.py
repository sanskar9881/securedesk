"""NotificationsRepository — in-app notification feed (distinct from alerts)."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class NotificationsRepository(TenantScopedRepository):
    collection_name = "notifications"
