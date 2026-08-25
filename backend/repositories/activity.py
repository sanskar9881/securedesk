"""
ActivityRepository — activity_logs, tenant-scoped.

Thin on purpose: routes/admin.py and the compliance/UEBA services build
their own query fragments (classification, severity, date range, search)
on top of this. Their job is deciding *what* to ask for; this repository's
only job is guaranteeing *whose* data they can ask about.
"""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class ActivityRepository(TenantScopedRepository):
    collection_name = "activity_logs"

    async def recent(self, limit: int = 25):
        return self.find_many({}, sort=[("timestamp", -1)]).limit(limit)
