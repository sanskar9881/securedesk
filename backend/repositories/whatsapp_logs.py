"""WhatsAppLogsRepository — DLP events from the Chrome extension on WhatsApp Web."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class WhatsAppLogsRepository(TenantScopedRepository):
    collection_name = "whatsapp_logs"
