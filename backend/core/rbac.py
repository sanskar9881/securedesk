"""
Role-based access control.

Three roles, with genuinely different reach. Before this module, every check in
the codebase read `role in ("admin", "manager")`, which made the two
indistinguishable — a manager could delete users and export the entire
company. That is now separated:

    admin    — full control of the organisation. Manages people and roles,
               sees and analyses every employee's activity, exports company
               data, edits org settings.
    manager  — oversight of their reports only. Sees and analyses the activity
               of users assigned to them; cannot manage accounts, cannot change
               roles, cannot export company-wide, cannot act on another manager
               or on an admin.
    user     — their own work only. Full use of the scanning/analysis tools on
               their own content; no visibility into anyone else.

The scope helpers return a Mongo filter rather than a boolean, so callers can
apply the same rule to any collection instead of re-deriving it (and getting it
subtly wrong) at each call site.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException

from routes.auth import get_current_user

ADMIN = "admin"
MANAGER = "manager"
USER = "user"

STAFF = (ADMIN, MANAGER)


# ── Role guards ────────────────────────────────────────────────────

async def require_admin(user=Depends(get_current_user)):
    """Organisation-wide control. Nothing below admin passes."""
    if user.get("role") != ADMIN:
        raise HTTPException(403, "This action requires administrator access.")
    return user


async def require_staff(user=Depends(get_current_user)):
    """
    Oversight screens shared by admin and manager. The two see DIFFERENT data
    behind this gate — apply `visibility_filter()` to scope the query.
    """
    if user.get("role") not in STAFF:
        raise HTTPException(403, "This action requires manager or administrator access.")
    return user


async def require_manager(user=Depends(get_current_user)):
    """Manager-specific surfaces (e.g. reporting up to admin)."""
    if user.get("role") not in STAFF:
        raise HTTPException(403, "This action requires manager access.")
    return user


# ── Data scoping ───────────────────────────────────────────────────

def is_admin(user: dict) -> bool:
    return user.get("role") == ADMIN


def is_staff(user: dict) -> bool:
    return user.get("role") in STAFF


async def managed_user_ids(user: dict) -> list[str]:
    """
    The users a manager oversees: the plain users in their tenant, plus
    themselves. Managers never oversee admins or other managers — that is what
    stops a manager reaching an admin account and escalating.

    Tenant is `org_id` when set. Installs that predate organisations leave it
    unset on every account; there we scope to the other org-less users, which
    is the same single tenant. The two pools never mix, so creating an
    organisation later tightens scope rather than widening it.
    """
    from database import users_collection

    org_id = user.get("org_id")
    query: dict = {"role": USER}
    query["org_id"] = org_id if org_id else None

    ids = [d["_id"] async for d in users_collection.find(query, {"_id": 1})]
    ids.append(user["_id"])
    return ids


async def visible_user_ids(user: dict) -> list[str] | None:
    """
    The set of account ids whose records `user` may read.

        admin   -> everyone in their organisation
        manager -> their reports, plus themselves
        user    -> themselves only

    Returns None to mean "no restriction" — only for an admin with no org_id
    set (single-tenant / pre-org installs), where scoping by organisation would
    hide their own data from them.
    """
    from database import users_collection

    role = user.get("role")

    if role == ADMIN:
        org_id = user.get("org_id")
        if not org_id:
            # Pre-organisation install: one tenant, so no scoping to apply.
            return None
        return [d["_id"] async for d in users_collection.find({"org_id": org_id}, {"_id": 1})]

    if role == MANAGER:
        return await managed_user_ids(user)

    return [user["_id"]]


async def visibility_filter(user: dict, field: str = "user_id") -> dict:
    """
    Mongo filter restricting a collection to what `user` may see.

    `field` is the document key holding the owning account id — the collections
    disagree (`user_id` on activity, `owner_id` on fingerprints, `sender_id` on
    transactions), so the caller names it.
    """
    ids = await visible_user_ids(user)
    if ids is None:
        return {}
    return {field: {"$in": ids}}


async def assert_can_act_on(actor: dict, target_id: str) -> dict:
    """
    Guard for operations against another account (view detail, deactivate,
    change role). Returns the target document.

    Admin may act on anyone in their org. A manager may act only on their own
    reports — never on an admin or another manager, which is what stops a
    manager from escalating by editing an admin account.
    """
    from database import users_collection

    target = await users_collection.find_one({"_id": target_id})
    if not target:
        raise HTTPException(404, "That account no longer exists.")

    if is_admin(actor):
        if actor.get("org_id") and target.get("org_id") != actor.get("org_id"):
            raise HTTPException(403, "That account belongs to another organisation.")
        return target

    if actor.get("role") == MANAGER:
        if target.get("role") != USER:
            raise HTTPException(403, "Managers can only act on the people who report to them.")
        if target["_id"] not in await managed_user_ids(actor):
            raise HTTPException(403, "That person doesn't report to you.")
        return target

    if target["_id"] != actor["_id"]:
        raise HTTPException(403, "You can only act on your own account.")
    return target
