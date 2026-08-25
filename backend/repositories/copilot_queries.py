"""CopilotQueriesRepository — manager-copilot natural-language query log."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class CopilotQueriesRepository(TenantScopedRepository):
    collection_name = "copilot_queries"
