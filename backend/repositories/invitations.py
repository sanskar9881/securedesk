"""InvitationsRepository — pending org invites, consumed by routes/organization.py."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class InvitationsRepository(TenantScopedRepository):
    collection_name = "invitations"
