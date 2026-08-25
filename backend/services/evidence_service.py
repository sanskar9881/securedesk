"""
Evidence chain — append, verify, checkpoint.

Product context: SecureDesk's commercial value is the evidence trail, not
the detection. Customers buy it to satisfy DPDP Rules 2025 6(c) (visibility
over access to personal data through logs, monitoring and review) and 6(e)
(retention of logs for at least one year). If the chain can be forged, the
product has no value — see core/crypto.py for why hashing alone isn't
enough and what the Ed25519 signature adds.

This module is the only place that decides how an evidence entry is built,
chained, and signed. Callers (routes/evidence.py, routes/analyze.py, the
event bus once Phase 5 exists) never construct an entry_hash or touch
EvidenceChainHeadsRepository directly — they call append_entry().
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from core.config import get_settings
from core.crypto import GENESIS_HASH, entry_hash, now_millis, sign_head, verify_head_signature
from repositories.evidence import EvidenceCheckpointsRepository, EvidenceLogRepository
from repositories.evidence_chain_heads import EvidenceChainHeadsRepository

log = logging.getLogger("securedesk.evidence")

RETENTION = timedelta(days=365)   # DPDP Rule 6(e): at least one year
CHECKPOINT_EVERY = 100
CHECKPOINT_MAX_AGE = timedelta(days=1)
_MAX_CAS_RETRIES = 8

# Every event type this chain can record. append_entry() rejects anything
# not in this set — an unrecognised event_type is far more likely to be a
# typo than a new, deliberately-added kind of evidence.
EVENT_TYPES = frozenset({
    "scan_allowed", "scan_warned", "scan_blocked",
    "whatsapp_file_blocked", "whatsapp_file_warned", "whatsapp_file_allowed",
    "browser_upload_blocked", "policy_changed",
    "device_heartbeat_lost", "device_enrolled", "device_revoked",
    "evidence_pack_generated", "manual_scan", "override_requested",
    "extension_interception_degraded", "queue_overflow",
    # Phase 4 — refresh-token rotation reuse detection (services/token_service.py).
    "auth_refresh_reuse_detected",
})

# Every entry satisfies both controls: 6(c) because an evidence entry IS
# the monitoring/review log the rule requires, 6(e) because retain_until
# (set on every entry below) enforces the one-year floor structurally
# rather than by event type. There is no event type in EVENT_TYPES that
# would satisfy one control but not the other.
DPDP_CONTROLS = ["DPDP Rule 6(c)", "DPDP Rule 6(e)"]

_ENTRY_BODY_FIELDS = ("org_id", "user_id", "seq", "event_type", "timestamp", "payload", "dpdp_controls")


def _require_evidence_enabled() -> None:
    settings = get_settings()
    if not settings.EVIDENCE_ENABLED:
        raise RuntimeError(
            "Evidence chain is disabled (EVIDENCE_ENABLED=false). Set it to true and configure "
            "EVIDENCE_SIGNING_KEY / EVIDENCE_PUBLIC_KEY — see scripts/generate_evidence_keypair.py."
        )
    if not settings.EVIDENCE_SIGNING_KEY:
        raise RuntimeError("EVIDENCE_ENABLED is true but EVIDENCE_SIGNING_KEY is not set.")


# ─────────────────────────────────────────────────────────────────────
# Append
# ─────────────────────────────────────────────────────────────────────

async def append_entry(db, org_id: str, *, user_id: str, event_type: str, payload: dict) -> dict:
    """
    Append one entry to org_id's evidence chain. Returns the stored entry.

    This is the blocking=True handler in the (future) event-bus wiring —
    the scan pipeline calls it directly and awaits it before responding,
    because a scan decision that was never durably logged is not the
    product SecureDesk sells.

    payload must never contain raw PII values (actual PAN/Aadhaar digits,
    card numbers, file contents) — only categories, counts, and non-
    identifying summaries. That redaction is the caller's responsibility
    (see routes/analyze.py); this function does not inspect payload
    content, only that it's present and JSON-serialisable for hashing.
    """
    if event_type not in EVENT_TYPES:
        raise ValueError(
            f"unknown evidence event_type {event_type!r}. Add it to EVENT_TYPES in "
            f"services/evidence_service.py if this is a genuinely new kind of evidence."
        )
    _require_evidence_enabled()
    settings = get_settings()

    evidence_repo = EvidenceLogRepository(db, org_id)
    heads_repo = EvidenceChainHeadsRepository(db, org_id)

    for attempt in range(_MAX_CAS_RETRIES):
        head = await heads_repo.get_head()
        prev_hash = head["head_hash"] if head else GENESIS_HASH
        seq = (head["seq"] if head else 0) + 1
        timestamp = now_millis()

        body = {
            "org_id": org_id, "user_id": user_id, "seq": seq,
            "event_type": event_type, "timestamp": timestamp,
            "payload": payload, "dpdp_controls": DPDP_CONTROLS,
        }
        this_hash = entry_hash(body, prev_hash)
        signature = sign_head(org_id, seq, this_hash, timestamp, settings.EVIDENCE_SIGNING_KEY)

        # Reserve the sequence number before writing the entry, so a lost
        # race never leaves an entry in evidence_log whose seq didn't
        # actually stick — see repositories/evidence_chain_heads.py.
        if head is None:
            won = await heads_repo.create_genesis(
                seq=seq, head_hash=this_hash, signature=signature, timestamp=timestamp,
            )
        else:
            won = await heads_repo.advance(
                expected_seq=head["seq"], new_seq=seq, new_head_hash=this_hash,
                signature=signature, timestamp=timestamp,
            )

        if not won:
            continue  # lost the race — re-read the (now-advanced) head and retry

        entry_doc = {
            **body,
            "_id": str(uuid.uuid4()),
            "prev_hash": prev_hash,
            "entry_hash": this_hash,
            "retain_until": timestamp + RETENTION,
        }
        await evidence_repo.append(entry_doc)

        await _maybe_checkpoint(db, org_id, seq=seq, head_hash=this_hash, timestamp=timestamp)

        return entry_doc

    raise RuntimeError(
        f"evidence chain CAS retry limit ({_MAX_CAS_RETRIES}) exceeded for org {org_id} — "
        f"unexpectedly high write contention on a single organisation's chain."
    )


async def _maybe_checkpoint(db, org_id: str, *, seq: int, head_hash: str, timestamp: datetime) -> None:
    """Every 100 entries, unconditionally. Otherwise, once daily if the
    last checkpoint has aged out. Checkpoints are what let verification
    detect truncation — an attacker deleting the chain's tail also has to
    explain away a checkpoint that no longer matches."""
    if seq % CHECKPOINT_EVERY == 0:
        await _write_checkpoint(db, org_id, seq=seq, head_hash=head_hash, timestamp=timestamp)
        return

    checkpoints_repo = EvidenceCheckpointsRepository(db, org_id)
    latest = await checkpoints_repo.latest()
    if latest is None or (timestamp - latest["timestamp"]) >= CHECKPOINT_MAX_AGE:
        await _write_checkpoint(db, org_id, seq=seq, head_hash=head_hash, timestamp=timestamp)


async def _write_checkpoint(db, org_id: str, *, seq: int, head_hash: str, timestamp: datetime) -> None:
    settings = get_settings()
    signature = sign_head(org_id, seq, head_hash, timestamp, settings.EVIDENCE_SIGNING_KEY)
    await EvidenceCheckpointsRepository(db, org_id).append({
        "_id": str(uuid.uuid4()),
        "seq": seq,
        "head_hash": head_hash,
        "entry_count": seq,   # seq IS the total count since genesis — no separate counter to drift
        "timestamp": timestamp,
        "signature": signature,
    })
    log.info("evidence checkpoint written org_id=%s seq=%d", org_id, seq)


# ─────────────────────────────────────────────────────────────────────
# Verify
# ─────────────────────────────────────────────────────────────────────

async def verify_chain(db, org_id: str) -> dict:
    """
    Walk org_id's entire evidence chain and report whether it holds.

    Checks, in order:
      1. Every entry's entry_hash matches SHA-256(canonical_json(body) + prev_hash)
         recomputed from its own stored content — catches any edited field.
      2. Every entry's prev_hash matches the previous entry's entry_hash —
         catches a reordered or spliced-in entry.
      3. Sequence numbers are contiguous from 1 — catches a deleted entry.
      4. The chain head's signature verifies against EVIDENCE_PUBLIC_KEY —
         catches an attacker who rewrote hashes with full database access
         but does not have the private key.
      5. Every checkpoint's recorded hash matches the real entry at that
         seq, and its own signature verifies — catches truncation that
         happened to also patch up the live head.

    Returns a dict with both a plain-English verdict (for an auditor) and
    a `problems` list (machine-readable, one dict per finding, each naming
    the specific seq involved).
    """
    settings = get_settings()
    evidence_repo = EvidenceLogRepository(db, org_id)
    heads_repo = EvidenceChainHeadsRepository(db, org_id)
    checkpoints_repo = EvidenceCheckpointsRepository(db, org_id)

    head = await heads_repo.get_head()
    if head is None:
        return {
            "chain_intact": True,
            "head_signature_valid": None,
            "entries_verified": 0,
            "expected_entries": 0,
            "last_checkpoint_at": None,
            "last_checkpoint_seq": None,
            "problems": [],
            "verdict": "No evidence has been recorded for this organisation yet. There is no chain to verify.",
        }

    problems: list[dict] = []

    # ── 4. head signature ────────────────────────────────────────────
    head_signature_valid = None
    if settings.EVIDENCE_PUBLIC_KEY:
        head_signature_valid = verify_head_signature(
            org_id, head["seq"], head["head_hash"], head["updated_at"],
            head["signature"], settings.EVIDENCE_PUBLIC_KEY,
        )
        if not head_signature_valid:
            problems.append({
                "type": "head_signature_invalid", "seq": head["seq"],
                "detail": "The chain head's signature does not verify against the configured "
                          "public key. Either the head was tampered with, or it was signed with "
                          "a different private key than the one EVIDENCE_PUBLIC_KEY corresponds to.",
            })
    else:
        problems.append({
            "type": "public_key_not_configured", "seq": None,
            "detail": "EVIDENCE_PUBLIC_KEY is not set — signatures cannot be checked at all.",
        })

    # ── 1, 2, 3. walk the entries ─────────────────────────────────────
    entries_verified = 0
    expected_seq = 1
    prev_hash = GENESIS_HASH
    last_seen_hash = GENESIS_HASH
    last_seen_seq = 0

    cursor = evidence_repo.find_many({}, sort=[("seq", 1)])
    async for entry in cursor:
        if entry["seq"] != expected_seq:
            problems.append({
                "type": "sequence_gap", "seq": expected_seq,
                "detail": f"Expected entry #{expected_seq} but found #{entry['seq']} next — "
                          f"one or more entries between them are missing.",
            })
            expected_seq = entry["seq"]

        if entry["prev_hash"] != prev_hash:
            problems.append({
                "type": "broken_link", "seq": entry["seq"],
                "detail": "This entry's prev_hash does not match the previous entry's hash — "
                          "the chain was reordered, or an entry was inserted or removed.",
            })

        recomputed = entry_hash({k: entry[k] for k in _ENTRY_BODY_FIELDS}, entry["prev_hash"])
        if recomputed != entry["entry_hash"]:
            problems.append({
                "type": "hash_mismatch", "seq": entry["seq"],
                "detail": "The recomputed hash of this entry's own content does not match its "
                          "stored entry_hash — the entry's content was altered after it was written.",
            })

        prev_hash = entry["entry_hash"]
        last_seen_hash = entry["entry_hash"]
        last_seen_seq = entry["seq"]
        expected_seq += 1
        entries_verified += 1

    # ── truncation: fewer entries than the head claims ────────────────
    if last_seen_seq < head["seq"]:
        for missing_seq in range(last_seen_seq + 1, head["seq"] + 1):
            problems.append({
                "type": "missing_entry", "seq": missing_seq,
                "detail": f"The chain head reports {head['seq']} entries, but #{missing_seq} is "
                          f"absent from evidence_log — likely truncation.",
            })
    elif last_seen_seq == head["seq"] and last_seen_hash != head["head_hash"]:
        problems.append({
            "type": "head_mismatch", "seq": head["seq"],
            "detail": "The last entry's hash does not match the chain head's recorded hash.",
        })

    # ── 5. checkpoints ─────────────────────────────────────────────────
    async for cp in checkpoints_repo.find_many({}, sort=[("seq", 1)]):
        target = await evidence_repo.get_by_seq(cp["seq"])
        if target is None:
            problems.append({
                "type": "checkpoint_target_missing", "seq": cp["seq"],
                "detail": f"Checkpoint at #{cp['seq']} exists but that entry is missing from "
                          f"evidence_log — the chain was truncated after this checkpoint was made.",
            })
            continue
        if target["entry_hash"] != cp["head_hash"]:
            problems.append({
                "type": "checkpoint_hash_mismatch", "seq": cp["seq"],
                "detail": f"Checkpoint at #{cp['seq']} recorded a different hash than that entry "
                          f"currently has — the entry was altered after the checkpoint was made.",
            })
        if settings.EVIDENCE_PUBLIC_KEY and not verify_head_signature(
            org_id, cp["seq"], cp["head_hash"], cp["timestamp"], cp["signature"], settings.EVIDENCE_PUBLIC_KEY,
        ):
            problems.append({
                "type": "checkpoint_signature_invalid", "seq": cp["seq"],
                "detail": f"Checkpoint at #{cp['seq']}'s signature does not verify.",
            })

    last_checkpoint = await checkpoints_repo.latest()
    chain_intact = len(problems) == 0

    if chain_intact:
        verdict = (
            f"All {entries_verified} evidence entries for this organisation form an unbroken, "
            f"cryptographically verified chain from entry 1 through {head['seq']}. The chain "
            f"head's signature is valid, which an attacker with only database access — no access "
            f"to the signing key — could not have produced after altering any entry. This chain "
            f"can be relied on as evidence."
        )
    else:
        seqs = sorted({p["seq"] for p in problems if p.get("seq") is not None})
        verdict = (
            f"{len(problems)} problem(s) were found verifying this organisation's evidence chain "
            f"(entries {entries_verified} of {head['seq']} expected). Affected sequence "
            f"number(s): {', '.join(str(s) for s in seqs) if seqs else 'n/a'}. "
            f"This chain should NOT be relied on as evidence until investigated."
        )

    return {
        "chain_intact": chain_intact,
        "head_signature_valid": head_signature_valid,
        "entries_verified": entries_verified,
        "expected_entries": head["seq"],
        "last_checkpoint_at": last_checkpoint["timestamp"].isoformat() if last_checkpoint else None,
        "last_checkpoint_seq": last_checkpoint["seq"] if last_checkpoint else None,
        "problems": problems,
        "verdict": verdict,
    }


# ─────────────────────────────────────────────────────────────────────
# Read paths (feed / stats)
# ─────────────────────────────────────────────────────────────────────

async def get_feed(
    db, org_id: str, *,
    user_id: str | None, is_staff: bool,
    event_type: str | None = None,
    start: datetime | None = None, end: datetime | None = None,
    page: int = 1, limit: int = 25,
) -> dict:
    """Org-scoped, paginated, filterable evidence feed. Employees
    (is_staff=False) only ever see entries where they are user_id —
    the same "own work only" boundary core/rbac.py applies elsewhere."""
    repo = EvidenceLogRepository(db, org_id)
    filt: dict = {}
    if not is_staff:
        filt["user_id"] = user_id
    if event_type:
        if event_type not in EVENT_TYPES:
            raise ValueError(f"unknown event_type {event_type!r}")
        filt["event_type"] = event_type
    if start or end:
        ts_filter: dict = {}
        if start: ts_filter["$gte"] = start
        if end: ts_filter["$lte"] = end
        filt["timestamp"] = ts_filter

    total = await repo.count(filt)
    skip = (page - 1) * limit
    cursor = repo.find_many(filt, sort=[("seq", -1)]).skip(skip).limit(limit)

    rows = []
    async for entry in cursor:
        entry["timestamp"] = entry["timestamp"].isoformat()
        entry["retain_until"] = entry["retain_until"].isoformat()
        rows.append(entry)

    return {"total": total, "page": page, "limit": limit, "data": rows}


async def get_stats(db, org_id: str) -> dict:
    """Counts by event_type, chain length, blocked count, logging-since date."""
    repo = EvidenceLogRepository(db, org_id)

    counts_by_event_type: dict[str, int] = {}
    cursor = await repo.aggregate([{"$group": {"_id": "$event_type", "count": {"$sum": 1}}}])
    async for row in cursor:
        counts_by_event_type[row["_id"]] = row["count"]

    blocked_count = sum(
        count for event_type, count in counts_by_event_type.items()
        if event_type.endswith("_blocked")
    )

    earliest = await repo.find_one({}, sort=[("seq", 1)])
    heads_repo = EvidenceChainHeadsRepository(db, org_id)
    head = await heads_repo.get_head()

    return {
        "chain_length": head["seq"] if head else 0,
        "counts_by_event_type": counts_by_event_type,
        "blocked_count": blocked_count,
        "logging_since": earliest["timestamp"].isoformat() if earliest else None,
    }
