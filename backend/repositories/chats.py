"""ChatsRepository — the general-purpose AI chatbot's conversations."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class ChatsRepository(TenantScopedRepository):
    collection_name = "chats"
