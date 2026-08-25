"""
Report the blast radius for the Phase 2 tenant-isolation migration.

Read-only: it counts and samples, it never writes. Run it against
production before migrating, so the migration's inputs are measured rather
than assumed.

Usage:
    python -m scripts.tenancy_audit

    # against production, without editing .env
    MONGODB_URL='mongodb+srv://...' DATABASE_NAME=cybersec_db \
        python -m scripts.tenancy_audit
"""
from __future__ import annotations

import asyncio

from core.config import get_settings
from scripts.tenancy_common import CANDIDATE_FIELDS, NON_EMPTY as SET, OWNER_FIELDS


async def audit() -> None:
    settings = get_settings()
    # Scripts run outside the app lifespan and open the connection themselves.
    from core.database import connect, disconnect, get_database

    host = settings.MONGODB_URL.split("@")[-1].split("/")[0]
    print(f"database : {settings.DATABASE_NAME} @ {host}")
    print(f"env      : {settings.ENVIRONMENT}\n")

    try:
        await connect()
        db = get_database()
        await db.command("ping")
    except Exception as exc:
        print(f"UNREACHABLE: {type(exc).__name__}: {str(exc)[:200]}")
        return
    names = sorted(await db.list_collection_names())

    # ── users ────────────────────────────────────────────────────────
    total_users = await db["users"].count_documents({}) if "users" in names else 0
    users_with_org = (
        await db["users"].count_documents({"org_id": SET}) if "users" in names else 0
    )
    print("USERS")
    print(f"  total                 : {total_users}")
    print(f"  with non-null org_id  : {users_with_org}")
    print(f"  needing a new org     : {total_users - users_with_org}")
    if "users" in names:
        for role in ("admin", "manager", "user"):
            n = await db["users"].count_documents({"role": role})
            print(f"    role={role:<8}: {n}")
        no_role = await db["users"].count_documents({"role": {"$in": [None, ""]}})
        if no_role:
            print(f"    role missing  : {no_role}")

    # ── every collection ─────────────────────────────────────────────
    print("\nCOLLECTIONS")
    header = f"  {'collection':<22}{'docs':>8}{'org_id':>9}{'owner':>9}{'orphan':>9}  owner field"
    print(header)
    print("  " + "-" * (len(header) - 2))

    orphan_total = 0
    for name in names:
        coll = db[name]
        docs = await coll.count_documents({})
        with_org = await coll.count_documents({"org_id": SET})

        field = OWNER_FIELDS.get(name)
        if field is None and name != "users":
            # Probe for whichever candidate actually carries values.
            for cand in CANDIDATE_FIELDS:
                if await coll.count_documents({cand: SET}, limit=1):
                    field = cand
                    break

        if name == "users":
            attributable, orphans, field_label = docs, 0, "(is the user)"
        elif field:
            attributable = await coll.count_documents({field: SET})
            orphans = docs - attributable
            field_label = field
        else:
            attributable, orphans, field_label = 0, docs, "NONE FOUND"

        orphan_total += orphans
        flag = "  <-- quarantine" if orphans else ""
        print(f"  {name:<22}{docs:>8}{with_org:>9}{attributable:>9}{orphans:>9}  {field_label}{flag}")

    print(f"\n  documents not attributable to a user: {orphan_total}")
    print("  (these go to the quarantine collection — never inferred)")

    # ── organisations ────────────────────────────────────────────────
    if "organizations" in names:
        print(f"\nORGANIZATIONS: {await db['organizations'].count_documents({})}")
    else:
        print("\nORGANIZATIONS: collection does not exist")

    await disconnect()


if __name__ == "__main__":
    asyncio.run(audit())
