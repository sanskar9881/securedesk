"""NDA / onboarding repositories — both consumed only by routes/onboarding.py."""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class NdaAgreementsRepository(TenantScopedRepository):
    collection_name = "nda_agreements"


class OnboardingRecordsRepository(TenantScopedRepository):
    collection_name = "onboarding_records"
