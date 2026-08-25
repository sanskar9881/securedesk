"""
In-process event bus — formalises the pattern the scan pipeline already
used ad hoc (see services/event_handlers.py, and the docstring that used
to live directly on routes/analyze.py's evidence-write helper: "this is
the blocking=True handler in the (future) event-bus wiring").

Not a distributed queue — there is no broker in this stack (no Kafka/
Redis/RabbitMQ client in requirements.txt), and a single-region FastAPI
monolith on Render doesn't need one yet. This is the in-process
publish/subscribe abstraction a real broker would eventually sit behind:
call sites (routes) publish events and never call a specific handler
directly, so gaining a new handler — or moving to a real queue later —
never touches the call site.

Two handler kinds:

  BLOCKING handlers run synchronously, in registration order, awaited
  before publish() returns. Use this for anything the request must not
  succeed without having durably done — today, exactly one thing
  qualifies: the evidence chain write (see services/event_handlers.py,
  which also wraps it in the Phase 6 circuit breaker/retry policy). A
  blocking handler that raises propagates out of publish() as-is; the
  publisher decides what that means for its response, exactly as it did
  before this module existed.

  BACKGROUND handlers are scheduled with asyncio.create_task and never
  awaited by publish() — a failure is caught and logged, never raised to
  the publisher. Nothing subscribes in the background tier yet;
  routes/analyze.py still uses FastAPI's own BackgroundTasks for the
  manager email alert, which gets the same "don't block the response"
  property a different way. Both mechanisms are fine; a handler is free to
  use either.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Awaitable, Callable

log = logging.getLogger("securedesk.events")

Handler = Callable[..., Awaitable[None]]


@dataclass
class _Subscription:
    handler: Handler
    blocking: bool


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, list[_Subscription]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Handler, *, blocking: bool = True) -> None:
        self._subs[event_type].append(_Subscription(handler=handler, blocking=blocking))

    async def publish(self, event_type: str, /, *args, **kwargs) -> list:
        """
        Run every blocking handler for `event_type`, in registration
        order, awaited in turn — the first one to raise stops the rest and
        propagates to the caller. Then fire every background handler
        without waiting for them.

        Returns the blocking handlers' return values, in registration
        order (background handlers' results are fire-and-forget and never
        included — publish() has already returned by the time they finish).
        Callers that don't need it just discard it, as every caller did
        before this returned anything; a publisher that wants a value back
        — e.g. routes/analyze.py reading the evidence entry's _id out of
        services/event_handlers.py's write, to hand back as evidence_id in
        its HTTP response — reads results[0].

        Publishing an event_type with zero subscribers is not an error —
        that's the normal case for most event types most of the time, not
        a misconfiguration.
        """
        subs = self._subs.get(event_type, ())
        results = []
        for sub in subs:
            if sub.blocking:
                results.append(await sub.handler(*args, **kwargs))

        for sub in subs:
            if not sub.blocking:
                asyncio.create_task(self._run_background(event_type, sub.handler, args, kwargs))

        return results

    @staticmethod
    async def _run_background(event_type: str, handler: Handler, args: tuple, kwargs: dict) -> None:
        try:
            await handler(*args, **kwargs)
        except Exception:
            log.exception("background event handler failed event_type=%s handler=%s",
                          event_type, getattr(handler, "__qualname__", handler))


# Process-wide singleton. One bus per process is correct here — handlers
# are registered once at startup (see services/event_handlers.py,
# main.py's lifespan), not per-request.
bus = EventBus()
