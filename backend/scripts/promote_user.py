"""
Grant a role to an existing account, from the shell.

Registration is public, so it can only ever create plain users. That leaves
a fresh install with no admin and no way to make one over the API — this
script is the bootstrap, and it deliberately requires shell access to the
deployment plus the database credentials.

Usage:
    python -m scripts.promote_user <email-or-phone> <admin|manager|user>

Examples:
    python -m scripts.promote_user founder@company.in admin
    python -m scripts.promote_user 9876543210 manager
"""
from __future__ import annotations

import asyncio
import sys

from core.config import get_settings

VALID_ROLES = ("admin", "manager", "user")


def _clean(identifier: str) -> str:
    """Mirror routes.auth.clean_identifier so lookups match how users are stored."""
    import re

    identifier = identifier.strip()
    if "@" in identifier:
        return identifier.lower()
    cleaned = re.sub(r"[\s\-\(\)\+]", "", identifier)
    if cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    return cleaned


async def promote(identifier: str, role: str) -> int:
    # Scripts run outside the app lifespan, so they open the connection
    # themselves. Without this the collection handles raise.
    from core.database import connect, disconnect, get_database

    await connect()
    users_collection = get_database()["users"]

    cid = _clean(identifier)
    user = await users_collection.find_one(
        {"$or": [{"email": cid}, {"phone": cid}]}
    )
    if not user:
        print(f"No account found for {identifier!r}.")
        await disconnect()
        return 1

    previous = user.get("role", "user")
    if previous == role:
        print(f"{user.get('name', identifier)} is already {role}. Nothing to do.")
        await disconnect()
        return 0

    await users_collection.update_one({"_id": user["_id"]}, {"$set": {"role": role}})
    print(f"{user.get('name', identifier)} ({user['_id']}): {previous} -> {role}")
    await disconnect()
    return 0


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    identifier, role = sys.argv[1], sys.argv[2].strip().lower()
    if role not in VALID_ROLES:
        print(f"Role must be one of {', '.join(VALID_ROLES)}; got {role!r}.")
        return 2

    settings = get_settings()
    print(f"Database: {settings.DATABASE_NAME} ({settings.ENVIRONMENT})")
    return asyncio.run(promote(identifier, role))


if __name__ == "__main__":
    raise SystemExit(main())
