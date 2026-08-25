"""
Generic circuit breaker + bounded retry for a call that can be transiently
unavailable (today: MongoDB, via the evidence chain write — see
services/event_handlers.py). Two independent concerns:

  RETRY absorbs a single blip — a write that fails once and succeeds on a
  second attempt shouldn't cost the caller a 500. Retries a small, fixed
  number of times with short exponential backoff, and only for exception
  types the caller marks retryable (a ValueError from bad input is never
  retryable; a pymongo connection error is — see the retry_on parameter).

  CIRCUIT BREAKER protects against a sustained outage. After
  `failure_threshold` consecutive failed call()s (each already having
  exhausted its own retries), the circuit OPENs: for `reset_after_seconds`,
  every call fails immediately with CircuitOpenError instead of touching
  Mongo again — the point is to stop hammering an already-down dependency,
  not to keep retrying into it. After the cooldown, the next call is let
  through HALF_OPEN; success CLOSES the circuit again, failure re-OPENs it.

What this deliberately does NOT do: let a request succeed when the
protected call fails. The evidence chain's core invariant (Phase 3) is
that a scan decision is never left unlogged while the response claims
success — a circuit breaker that swallowed the failure and returned
"ok anyway" would violate that invariant in the name of resilience. Failing
FAST (this module) instead of failing SLOW (a full Mongo timeout on every
single request during an outage) is the actual improvement; the caller
still sees a failure and still decides what a failed write means for its
own response — see services/event_handlers.py for that decision.
"""
from __future__ import annotations

import asyncio
import logging
import time
from enum import Enum
from typing import Awaitable, Callable, TypeVar

log = logging.getLogger("securedesk.resilience")

T = TypeVar("T")


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """The circuit is open — the call was not attempted."""


class CircuitBreaker:
    def __init__(self, *, name: str, failure_threshold: int = 5, reset_after_seconds: float = 30.0):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_after_seconds = reset_after_seconds
        self._state = CircuitState.CLOSED
        self._consecutive_failures = 0
        self._opened_at: float | None = None

    @property
    def state(self) -> CircuitState:
        if self._state is CircuitState.OPEN and self._opened_at is not None:
            if time.monotonic() - self._opened_at >= self.reset_after_seconds:
                return CircuitState.HALF_OPEN
        return self._state

    def _on_success(self) -> None:
        if self._state is not CircuitState.CLOSED:
            log.warning("circuit_closed name=%s", self.name)
        self._state = CircuitState.CLOSED
        self._consecutive_failures = 0
        self._opened_at = None

    def _on_failure(self) -> None:
        self._consecutive_failures += 1
        if self._consecutive_failures >= self.failure_threshold:
            if self._state is not CircuitState.OPEN:
                log.error("circuit_open name=%s consecutive_failures=%d", self.name, self._consecutive_failures)
            self._state = CircuitState.OPEN
            self._opened_at = time.monotonic()

    async def call(self, fn: Callable[[], Awaitable[T]], *,
                    retries: int = 2, retry_on: tuple[type[Exception], ...] = (Exception,),
                    backoff_seconds: float = 0.2) -> T:
        """
        Run `fn()` (a zero-argument callable — the caller closes over
        whatever it needs, see services/event_handlers.py) under this
        breaker. Retries happen INSIDE one call() — the circuit only
        counts one failure or success per call(), not per attempt.
        """
        current = self.state
        if current is CircuitState.OPEN:
            raise CircuitOpenError(
                f"circuit '{self.name}' is open — failing fast without attempting the call"
            )

        last_exc: Exception | None = None
        attempts = retries + 1
        for attempt in range(attempts):
            try:
                result = await fn()
                self._on_success()
                return result
            except retry_on as e:
                last_exc = e
                if attempt < attempts - 1:
                    await asyncio.sleep(backoff_seconds * (2 ** attempt))
        self._on_failure()
        assert last_exc is not None
        raise last_exc
