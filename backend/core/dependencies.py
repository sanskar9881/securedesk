"""
Shared FastAPI dependencies for tenant-scoped routes.

get_current_user lives in routes/auth.py rather than here — moving it would
mean rewriting the import in every route module in the same pass as the
tenant-scoping migration, which is a bigger and riskier change than this
phase needs. This module only adds what's new: resolving the caller's
tenant, so routes can construct a repository without reaching for
`user["org_id"]` (and forgetting the falsy check) at every call site.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException

from routes.auth import get_current_user


async def get_tenant_id(user: dict = Depends(get_current_user)) -> str:
    """The caller's org_id, guaranteed non-empty or a 403.

    In practice this should never 403: get_current_user runs
    ensure_personal_org() on every request, so org_id is always set by the
    time a route body executes. The check stays here anyway — a dependency
    that hands a repository constructor an unchecked value is exactly the
    kind of call site TenantScopedRepository's own construction-time guard
    exists to catch, and it should never be this dependency that lets a
    falsy org_id slip through instead.
    """
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(403, "Your account is not linked to an organisation yet.")
    return org_id
