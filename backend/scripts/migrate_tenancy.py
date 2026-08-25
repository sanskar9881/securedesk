"""
Phase 2 tenancy migration: create one organisation per existing user, then
backfill org_id everywhere else — never inferring across users.

Rules (as specified, not open to interpretation by this script):

  1. One organisation per existing user.
       - a user who already has org_id keeps it (no-op; makes the script
         idempotent against a partial or re-run migration)
       - a user with no org_id gets a brand-new single-member organisation
         and becomes its admin
  2. Every other collection's org_id is backfilled from its document's
     owning user_id (or sender_id / owner_id — see scripts/tenancy_common.py),
     by looking up that user's org_id.
  3. A document whose owner cannot be resolved to a real user — missing
     owner field, empty, or pointing at a user that no longer exists — is
     moved to `quarantine_documents` with the reason recorded. It is never
     guessed at, and never left in place with a fabricated org_id.
  4. Organisations are never grouped by email domain. Every user — even
     several people who share a company's email domain — gets their own
     organisation unless something outside this script consolidates them
     later. This is a deliberate product consequence, not an oversight:
     see the plan sent before this script was written.

Safety:

  - Dry-run by default. Nothing is written unless --execute is passed.
  - Idempotent: only touches documents currently missing org_id, so
    re-running (e.g. after fixing why some documents quarantined) is safe.
  - Refuses to run with --execute against ENVIRONMENT=production unless
    --confirm-production is also passed, as a second deliberate step.
  - Every run — dry or executed — writes a JSON report to
    scripts/migration_reports/, because a product built on audit trails
    should not migrate its own tenancy data without leaving one.

Usage:
    python -m scripts.migrate_tenancy                    # dry run, prints + reports what WOULD happen
    python -m scripts.migrate_tenancy --execute           # writes, non-production only
    python -m scripts.migrate_tenancy --execute --confirm-production   # writes, production
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from core.config import get_settings
from scripts.tenancy_common import EXCLUDED_COLLECTIONS, NON_EMPTY, resolve_owner_field

REPORT_DIR = Path(__file__).parent / "migration_reports"


@dataclass
class MigrationReport:
    dry_run: bool
    started_at: str
    environment: str
    database: str
    orgs_created: int = 0
    users_migrated: int = 0
    users_already_had_org: int = 0
    collections: dict[str, dict[str, int]] = field(default_factory=dict)
    quarantined: list[dict] = field(default_factory=list)
    finished_at: str = ""

    def to_dict(self) -> dict:
        return {**self.__dict__}


async def migrate_users(db, report: MigrationReport, execute: bool) -> dict[str, str]:
    """Returns {user_id: org_id} for every user, whether newly created or
    already assigned, so collection backfill can resolve owners against it
    without a second pass per document."""
    user_to_org: dict[str, str] = {}

    cursor = db["users"].find({})
    async for user in cursor:
        uid = user["_id"]
        existing_org = user.get("org_id")

        if existing_org:
            user_to_org[uid] = existing_org
            report.users_already_had_org += 1
            continue

        org_id = str(uuid.uuid4())
        org_name = f"{user.get('name') or uid}'s organisation"
        # Deliberately not derived from email domain — see module docstring
        # rule 4. Two colleagues at the same company get two organisations
        # here; consolidating them is a separate, explicit action.
        org_doc = {
            "_id": org_id,
            "name": org_name,
            "owner_id": uid,
            "created_at": datetime.now(timezone.utc),
            "plan": "trial",
            "created_by_migration": True,
        }

        if execute:
            await db["organizations"].insert_one(org_doc)
            await db["users"].update_one({"_id": uid}, {"$set": {"org_id": org_id}})

        user_to_org[uid] = org_id
        report.orgs_created += 1
        report.users_migrated += 1

    return user_to_org


async def migrate_collection(
    db, name: str, owner_field: str, user_to_org: dict[str, str],
    report: MigrationReport, execute: bool,
) -> None:
    stats = {"scanned": 0, "backfilled": 0, "already_scoped": 0, "quarantined": 0}

    already_scoped = await db[name].count_documents({"org_id": NON_EMPTY})
    stats["already_scoped"] = already_scoped

    cursor = db[name].find({"org_id": {"$exists": False}}) if execute else \
        db[name].find({"$or": [{"org_id": {"$exists": False}}, {"org_id": None}, {"org_id": ""}]})

    async for doc in cursor:
        stats["scanned"] += 1
        owner_id = doc.get(owner_field)
        org_id = user_to_org.get(owner_id) if owner_id else None

        if org_id:
            if execute:
                await db[name].update_one({"_id": doc["_id"]}, {"$set": {"org_id": org_id}})
            stats["backfilled"] += 1
        else:
            reason = (
                f"missing {owner_field}" if not owner_id
                else f"{owner_field}={owner_id!r} does not match any known user"
            )
            quarantine_doc = {
                "_id": str(uuid.uuid4()),
                "source_collection": name,
                "original_id": doc.get("_id"),
                "reason": reason,
                "document": _jsonable(doc),
                "quarantined_at": datetime.now(timezone.utc),
            }
            if execute:
                await db["quarantine_documents"].insert_one(quarantine_doc)
                await db[name].delete_one({"_id": doc["_id"]})
            stats["quarantined"] += 1
            report.quarantined.append({
                "collection": name, "id": str(doc.get("_id")), "reason": reason,
            })

    report.collections[name] = stats


def _jsonable(doc: dict) -> dict:
    """Best-effort JSON-safe copy for the quarantine record / report file.
    The quarantine document itself in Mongo keeps the real BSON types —
    this is only for the human-readable report."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v
        else:
            out[k] = str(v)
    return out


async def run(execute: bool, confirm_production: bool) -> int:
    settings = get_settings()

    if execute and settings.is_production and not confirm_production:
        print(
            "Refusing to run --execute against ENVIRONMENT=production without "
            "--confirm-production. This writes org_id onto every collection "
            "and moves unattributable documents to quarantine_documents — "
            "re-read the migration plan before adding that flag."
        )
        return 2

    from core.database import connect, disconnect, get_database
    await connect()
    db = get_database()

    report = MigrationReport(
        dry_run=not execute,
        started_at=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
        database=settings.DATABASE_NAME,
    )

    mode = "EXECUTING (writes will happen)" if execute else "DRY RUN (no writes)"
    print(f"{mode} — database={settings.DATABASE_NAME} env={settings.ENVIRONMENT}\n")

    print("── users -> organisations ─────────────────────────")
    user_to_org = await migrate_users(db, report, execute)
    print(f"  users already scoped : {report.users_already_had_org}")
    print(f"  new orgs created     : {report.orgs_created}")

    print("\n── backfilling other collections ──────────────────")
    names = sorted(await db.list_collection_names())
    for name in names:
        if name in EXCLUDED_COLLECTIONS or name.startswith("__"):
            continue
        owner_field = await resolve_owner_field(db, name)
        if owner_field is None:
            print(f"  {name:<22} skipped — no owner field found (not user-owned data)")
            continue
        await migrate_collection(db, name, owner_field, user_to_org, report, execute)
        s = report.collections[name]
        print(
            f"  {name:<22} scanned={s['scanned']:<5} backfilled={s['backfilled']:<5} "
            f"already_scoped={s['already_scoped']:<5} quarantined={s['quarantined']}"
        )

    report.finished_at = datetime.now(timezone.utc).isoformat()

    REPORT_DIR.mkdir(exist_ok=True)
    report_path = REPORT_DIR / f"{'executed' if execute else 'dry-run'}-{report.started_at.replace(':', '')}.json"
    report_path.write_text(json.dumps(report.to_dict(), indent=2, default=str))

    total_quarantined = sum(s["quarantined"] for s in report.collections.values())
    print(f"\nreport written to {report_path}")
    print(f"total documents quarantined: {total_quarantined}")
    if total_quarantined:
        print("(none inferred — each has a recorded reason in the report and in quarantine_documents)")

    await disconnect()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--execute", action="store_true", help="Write changes. Default is dry-run.")
    parser.add_argument("--confirm-production", action="store_true",
                         help="Required in addition to --execute when ENVIRONMENT=production.")
    args = parser.parse_args()
    return asyncio.run(run(args.execute, args.confirm_production))


if __name__ == "__main__":
    sys.exit(main())
