"""
Dual-credential dependency for routes the Chrome extension calls directly.

Device tokens (Phase 4) are deliberately narrow: unlike a login session
(full account access via routes.auth.get_current_user), a device token is
scoped to one or more fixed capabilities and only unlocks a route that
explicitly opts in to a specific required scope, via
make_actor_dependency() below. Wiring it in is opt-in per route, not a
blanket alternate-auth path for the whole API — a route that still depends
on get_current_user alone continues to reject device tokens exactly as
before it existed, because a device token isn't a JWT and jose.jwt.decode
rejects it outright. That is what keeps this additive rather than a silent
widening of every session-authenticated endpoint's attack surface.
"""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.database import get_database
from core.tokens import DEVICE_TOKEN_PREFIX

log = logging.getLogger("securedesk.device_auth")

bearer = HTTPBearer()


def make_actor_dependency(required_scope: str):
    """
    Build a FastAPI dependency that authenticates EITHER:

      - a normal human session (JWT access token) -> full account access,
        exactly as get_current_user already behaves, or
      - a device token scoped to `required_scope` -> that user's account,
        restricted in practice to whatever the route does with it.

    Returns the same shape as get_current_user (a user dict with org_id
    guaranteed present via ensure_personal_org), plus a `_auth` key routes
    may read for evidence logging. Never returns a token that lacks the
    required scope — that request is rejected with 401 before the route
    body ever runs.
    """
    async def _actor(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
        token = creds.credentials

        if token.startswith(DEVICE_TOKEN_PREFIX):
            # Lazy imports: avoids a circular import at module load time
            # (core.device_auth <- routes.analyze, while routes.auth also
            # imports things that eventually touch core.database).
            from repositories.users import PreTenantAccounts
            from routes.auth import ensure_personal_org
            from services.token_service import DeviceTokenError, verify_device_token

            db = get_database()
            try:
                device = await verify_device_token(db, token, required_scope)
            except DeviceTokenError as e:
                raise HTTPException(401, str(e))

            user = await PreTenantAccounts(db).find_by_id(device["user_id"])
            if not user:
                raise HTTPException(401, "That device token's account no longer exists.")
            user = await ensure_personal_org(user)
            user = dict(user)
            user["_auth"] = {
                "method": "device_token",
                "device_id": device["_id"][:16],
                "scopes": device["scopes"],
            }
            return user

        # Not device-token-shaped: fall through to the normal session path.
        # Called directly rather than via Depends() — get_current_user's
        # only sub-dependency is `creds`, which is already in hand.
        from routes.auth import get_current_user as _get_current_user

        user = await _get_current_user(creds)
        user = dict(user)
        user.setdefault("_auth", {"method": "session"})
        return user

    return _actor


# Shared singleton for the one real scope in use (see
# services/token_service.py's DEVICE_TOKEN_SCOPES). Built once here rather
# than separately in every route module that needs it — routes/analyze.py's
# scan endpoints and routes/evidence.py's override-request endpoint both
# import this rather than each calling make_actor_dependency("dlp:scan")
# themselves, so there is exactly one HTTPBearer() instance and one place
# that says what "dlp:scan" routes exist.
dlp_scan_actor = make_actor_dependency("dlp:scan")
