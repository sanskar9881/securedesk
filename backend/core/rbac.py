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

Layering, since Phase 2: this module answers "which accounts, within my
organisation, may I see or act on" — a role question. It does not answer the
organisation boundary itself; that's TenantScopedRepository's job (see
repositories/base.py), applied structurally to every query rather than
trusted to a filter built here. The two compose: a route constructs its
repository scoped to the caller's org_id, then narrows further with
visibility_filter() for the role-based slice within that org.
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


def _users_repo(org_id: str):
    # Lazy import: avoids a circular import at module load time
    # (core.rbac <- routes.auth <- ... <- core.database).
    from core.database import get_database
    from repositories.users import UsersRepository
    return UsersRepository(get_database(), org_id)


async def managed_user_ids(user: dict) -> list[str]:
    """
    The users a manager oversees: the plain users in their organisation,
    plus themselves. Managers never oversee admins or other managers — that
    is what stops a manager reaching an admin account and escalating.

    org_id is guaranteed present — see routes/auth.py:ensure_personal_org,
    which every authenticated request runs through. There is no longer a
    "no org_id" branch here: that branch used to mean "scope to every other
    org-less account", which is exactly the cross-tenant read Phase 2 exists
    to close.
    """
    repo = _users_repo(user["org_id"])
    ids = [d["_id"] async for d in repo.find_many({"role": USER}, projection={"_id": 1})]
    ids.append(user["_id"])
    return ids


async def visible_user_ids(user: dict) -> list[str]:
    """
    The set of account ids whose records `user` may see, within their own
    organisation:

        admin   -> everyone in the organisation
        manager -> their reports, plus themselves
        user    -> themselves only

    Used to always return None for "no restriction" when an admin had no
    org_id. That case can't occur any more — org_id is mandatory — and
    removing it removes the only path by which this function could ever
    hand back every account regardless of tenant.
    """
    role = user.get("role")

    if role == ADMIN:
        repo = _users_repo(user["org_id"])
        return [d["_id"] async for d in repo.find_many({}, projection={"_id": 1})]

    if role == MANAGER:
        return await managed_user_ids(user)

    return [user["_id"]]


async def visibility_filter(user: dict, field: str = "user_id") -> dict:
    """
    Mongo filter restricting a collection to what `user` may see, within
    whatever organisation the caller's repository is already scoped to.

    `field` is the document key holding the owning account id — the collections
    disagree (`user_id` on activity, `owner_id` on fingerprints, `sender_id` on
    transactions), so the caller names it.
    """
    ids = await visible_user_ids(user)
    return {field: {"$in": ids}}


async def assert_can_act_on(actor: dict, target_id: str) -> dict:
    """
    Guard for operations against another account (view detail, deactivate,
    change role). Returns the target document.

    Admin may act on anyone in their org. A manager may act only on their own
    reports — never on an admin or another manager, which is what stops a
    manager from escalating by editing an admin account.

    The lookup itself is now tenant-scoped: `target` is fetched through a
    UsersRepository bound to the actor's org_id, so a target in a different
    organisation is a 404, not a document this function has to remember to
    reject after already reading it.
    """
    repo = _users_repo(actor["org_id"])
    target = await repo.find_one({"_id": target_id})
    if not target:
        raise HTTPException(404, "That account no longer exists.")

    if is_admin(actor):
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
