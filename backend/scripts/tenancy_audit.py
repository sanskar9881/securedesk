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

# The key holding the owning account id. The collections disagree, so each
# one is named explicitly; anything not listed is probed against all three.
OWNER_FIELDS = {
    "activity_logs":      "user_id",
    "alerts":             "user_id",
    "transactions":       "sender_id",
    "fingerprinted_files": "owner_id",
    "copilot_queries":    "user_id",
    "whatsapp_logs":      "user_id",
    "subscriptions":      "user_id",
    "ip_logs":            "user_id",
    "reset_tokens":       "user_id",
}
CANDIDATE_FIELDS = ("user_id", "sender_id", "owner_id")

SET = {"$nin": [None, ""]}


async def audit() -> None:
    settings = get_settings()
    from motor.motor_asyncio import AsyncIOMotorClient

    host = settings.MONGODB_URL.split("@")[-1].split("/")[0]
    print(f"database : {settings.DATABASE_NAME} @ {host}")
    print(f"env      : {settings.ENVIRONMENT}\n")

    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000)
    try:
        await client.admin.command("ping")
    except Exception as exc:
        print(f"UNREACHABLE: {type(exc).__name__}: {str(exc)[:200]}")
        return

    db = client[settings.DATABASE_NAME]
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

    client.close()


if __name__ == "__main__":
    asyncio.run(audit())
