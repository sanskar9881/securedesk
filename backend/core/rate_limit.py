"""
In-memory sliding-window rate limiter for the unauthenticated auth
endpoints (register/login/refresh) — the ones a credential-stuffing or
token-guessing script would hit, and the ones that exist specifically
before any authentication happens, so there's no user_id yet to key
anything else on.

In-memory, per-process: correct for SecureDesk's current single-instance
Render deployment. It stops being correct the moment the API runs on more
than one instance, because each process enforces its own independent
count — the fix then is a shared store (Redis or similar), not built here
since nothing in this stack talks to one yet. Flagged rather than silently
assumed away; see the module-level comment wherever a limiter is
constructed for what it's actually protecting.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    def __init__(self, *, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        """Raises 429 if `key` has already hit the limit within the
        window; otherwise records this attempt and returns."""
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window_seconds:
            q.popleft()
        if len(q) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (now - q[0])))
            raise HTTPException(
                429, f"Too many attempts. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        q.append(now)


def client_key(request: Request, identifier: str = "") -> str:
    """IP + identifier, so one abusive IP can't lock out someone else's
    account by hammering with their identifier in the request body, and a
    leaked/guessed identifier alone can't be used to lock an account out
    from every IP by only limiting on the identifier."""
    ip = request.client.host if request.client else "unknown"
    ident = identifier.lower().strip()
    return f"{ip}:{ident}" if ident else ip


# Deliberately different budgets: login is the classic credential-stuffing
# target (many passwords against one identifier, or one password sprayed
# across many); register is cheaper to abuse for account-flooding but has
# no password-guessing risk; refresh is normal traffic under legitimate use
# (every short-lived access token expiring triggers one) so its budget is
# generous — it only needs to catch a token-guessing script, not slow down
# real users.
login_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=60)
register_limiter = SlidingWindowLimiter(max_requests=5, window_seconds=60)
refresh_limiter = SlidingWindowLimiter(max_requests=30, window_seconds=60)
