"""Billing repositories — consumed only by routes/billing.py, which is
unmounted (see main.py). Built now so the route can be migrated onto the
repository layer alongside everything else; self-serve checkout itself is
off the roadmap."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class SubscriptionsRepository(TenantScopedRepository):
    collection_name = "subscriptions"


class PaymentsRepository(TenantScopedRepository):
    collection_name = "payments"
