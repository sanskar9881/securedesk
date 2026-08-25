"""
Wires evidence_service.append_entry onto the event bus (core/events.py) as
the blocking handler for every event that must land in the evidence chain
before its request can succeed, protected by a Phase 6 circuit breaker +
bounded retry (core/circuit_breaker.py).

register_handlers() is called once from main.py's lifespan, so subscription
happens exactly once per process regardless of how many times routes
modules get imported. Routes never call evidence_service or the breaker
directly — they publish(event_type, ...) and this module owns what happens
next (see routes/analyze.py for scan decisions, routes/evidence.py for
override requests).
"""
from __future__ import annotations

import logging

from pymongo.errors import PyMongoError

from core.circuit_breaker import CircuitBreaker
from core.events import bus
from services import evidence_service

log = logging.getLogger("securedesk.event_handlers")

# One breaker for the evidence chain write specifically — not shared with
# anything else, so an outage in some future handler can't trip this one
# and vice versa. failure_threshold=5 / reset_after=30s: absorbs a short
# Mongo blip (retried inside CircuitBreaker.call before it even counts as
# one failure) without opening, but stops hammering a genuinely down
# primary within a handful of requests instead of timing out on every
# single one.
evidence_write_breaker = CircuitBreaker(
    name="evidence_chain_write", failure_threshold=5, reset_after_seconds=30.0,
)


async def _write_evidence_entry(db, org_id: str, *, user_id: str, event_type: str, payload: dict) -> dict:
    """
    Generic evidence-chain write, subscribed under several event types
    (see register_handlers below) — nothing here is scan-specific despite
    the module's original scan-only scope; append_entry() itself is what
    validates event_type against EVENT_TYPES.

    Returns the stored entry (see evidence_service.append_entry) —
    core.events.EventBus.publish() collects blocking handlers' return
    values, so the publisher can read entry["_id"] back as evidence_id in
    its HTTP response without importing evidence_service or the breaker.
    """
    async def _write():
        return await evidence_service.append_entry(
            db, org_id, user_id=user_id, event_type=event_type, payload=payload,
        )

    # retry_on is PyMongoError specifically, not Exception: a ValueError
    # from append_entry (unknown event_type — see services/evidence_service.py)
    # or a RuntimeError (EVIDENCE_ENABLED misconfigured) is a bug or a
    # config error, not a transient condition, and retrying either just
    # delays the same guaranteed failure. Only a driver-level error
    # (dropped connection, primary election, timeout) is worth retrying.
    return await evidence_write_breaker.call(_write, retries=2, retry_on=(PyMongoError,))


_REGISTERED = False


def register_handlers() -> None:
    """Idempotent — safe to call more than once (tests, reload)."""
    global _REGISTERED
    if _REGISTERED:
        return
    for event_type in ("scan_allowed", "scan_warned", "scan_blocked", "override_requested"):
        bus.subscribe(event_type, _write_evidence_entry, blocking=True)
    _REGISTERED = True
