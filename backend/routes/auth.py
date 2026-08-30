import logging
import re, uuid, bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.rate_limit import client_key, login_limiter, register_limiter, refresh_limiter
from jose import jwt, JWTError
from pydantic import BaseModel, ConfigDict
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from core.config import get_settings
from core.database import get_database
from repositories.invitations import PendingInvites
from repositories.organizations import OrganizationsRepository
from repositories.refresh_tokens import RefreshTokensRepository
from repositories.reset_tokens import ResetTokensRepository
from repositories.users import PreTenantAccounts
from core.tokens import hash_token
from services import token_service
from services.email_alert_service import send_password_reset_email

log = logging.getLogger("securedesk.auth")

router = APIRouter()
bearer = HTTPBearer()


async def ensure_personal_org(user: dict) -> dict:
    """
    Guarantee `user` has an org_id, creating a personal organisation if not.

    This is what makes org_id mandatory rather than optional: every account
    that authenticates — freshly registered, or an older account from before
    this existed — leaves this function with one. TenantScopedRepository
    raises on a falsy org_id by design (see repositories/base.py); this is
    the one place that guarantee gets made true, so nothing downstream needs
    a "what if there's no org" branch.

    One organisation per user, never grouped by email domain — same rule the
    Phase 2 migration script uses for existing data, applied here going
    forward for new and self-healing accounts instead. A user who wants to
    share an organisation with colleagues does so explicitly afterward
    (POST /api/org/create, invite flow), not by an inferred match.

    The account that a fresh organisation is created for IS that
    organisation's creator and owner, so it is set to `admin` here — of that
    org and only that org. This is the normal onboarding path: someone signs
    up, gets their own workspace, and can immediately invite their team from
    the Users page without an operator running promote_user for them. It is
    NOT a way to pick a role at registration: the role is forced to admin
    regardless of anything the request said, and only ever for a brand-new,
    single-member org. Anyone who instead JOINS an existing org via an
    invite already has org_id set before this runs, so the branch below is
    skipped entirely and their invited role is untouched.

    Idempotent: a user who already has org_id is returned unchanged, so this
    is safe to call on every register() and every login().
    """
    if user.get("org_id"):
        return user

    db = get_database()
    org_id = str(uuid.uuid4())
    await OrganizationsRepository(db).create(
        org_id=org_id,
        name=f"{user.get('name') or user['_id']}'s organisation",
        owner_id=user["_id"],
    )
    await PreTenantAccounts(db).assign_new_org(user["_id"], org_id, ADMIN_ROLE)
    user["org_id"] = org_id
    user["role"] = ADMIN_ROLE
    return user


def clean_identifier(s: str) -> str:
    s = s.strip()
    if "@" in s:
        return s.lower()
    cleaned = re.sub(r'[\s\-\(\)\+]', '', s)
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    return cleaned


def make_token(user_id: str, role: str) -> str:
    # "type": "access" is new in Phase 4, additive to the claim set — a
    # token decoded by any pre-Phase-4 code path (there is none left, but
    # in principle) still verifies fine since jose ignores unknown claims.
    # It exists so get_current_user can refuse a token that is shaped like
    # a JWT but was never meant to authenticate a request as this user —
    # nothing currently mints such a token, but the check is one line and
    # costs nothing to have ready.
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "type": "access", "exp": exp},
                      SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer)
):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY,
                             algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(401, "Invalid token")
        if payload.get("type") not in (None, "access"):
            # None is accepted for backward compatibility with tokens
            # minted before the "type" claim existed — that's every token
            # already in a user's browser at the moment this deploys.
            raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Token expired — please login again")

    user = await PreTenantAccounts(get_database()).find_by_id(uid)
    if not user:
        raise HTTPException(401, "User not found")
    # Self-heals any account from before org_id was mandatory (see
    # ensure_personal_org). Idempotent and near-free once the field is set —
    # this is what lets every route depend on org_id always being present
    # without a migration having to run first.
    return await ensure_personal_org(user)


async def admin_only(user=Depends(get_current_user)):
    """
    Legacy gate: any staff member (admin OR manager).

    Kept because several routes still import it, but prefer the explicit
    guards in core.rbac — `require_admin` for organisation-wide control and
    `require_staff` (plus `visibility_filter`) for oversight screens where a
    manager should see only their own reports.
    """
    if user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Manager or administrator access required")
    return user


# The roles an account may hold. Neither registration nor login lets a
# request select among these — the role always comes from the database
# (see register() and login()). Kept as the canonical list for reference
# and future validation.
VALID_ROLES = ("admin", "manager", "user")

# The role a public registration produces for someone JOINING an existing
# org via an invite that didn't specify otherwise.
USER_ROLE = "user"

# The role forced on the account a brand-new organisation is created for —
# its creator/owner. See ensure_personal_org. Never selectable by a request.
ADMIN_ROLE = "admin"


class RegisterBody(BaseModel):
    # Unknown fields are rejected, so the request shape stays a closed set and
    # a future privileged field can't be smuggled in by a stale client.
    model_config = ConfigDict(extra="forbid")

    name:       str
    identifier: str
    password:   str

    # Accepted and then ignored, deliberately.
    #
    # This field used to choose the new account's role, which let anyone on
    # the internet register as an administrator. It is declared here — rather
    # than rejected outright by extra="forbid" — only so that clients still
    # sending it get a normal 200 and a plain user account instead of a 422.
    # A single push can deploy frontend and backend in either order, so the
    # backend must not depend on the frontend going first.
    #
    # register() never reads this. Do not start.
    role: str | None = None

    # An opaque invite token (see POST /api/admin/invite). Unlike `role`
    # above, this DOES influence the new account's org and role — but it is
    # not a caller-chosen value: it was minted server-side by an
    # authenticated admin, is single-use, expires, and is looked up in the
    # database. The role still comes from that stored record, never from the
    # request body. Absent/blank/invalid → a normal public registration.
    invite: str | None = None


class LoginBody(BaseModel):
    identifier: str
    password:   str
    # Which console the person picked on the sign-in form. Purely advisory:
    # it NEVER grants anything (the role always comes from the database) and
    # it no longer blocks — a wrong pick used to 403, which meant a
    # mis-click on a radio button locked someone out of their own account.
    # The frontend now just corrects the picker with a toast and sends the
    # person to the console matching their real role. Still accepted so the
    # existing client keeps working; the response's `role` is the source of
    # truth for where to land.
    expected_role: str | None = None


@router.post("/register")
async def register(request: Request, body: RegisterBody):
    # Phase 6: rate limited before any DB work — an account-flooding
    # script should be turned away as cheaply as possible, not after a
    # duplicate-check query has already run.
    register_limiter.check(client_key(request, body.identifier))

    name  = body.name.strip()
    ident = body.identifier.strip()
    pw    = body.password

    # ── Validation ──────────────────────────────────────────────
    if not name or len(name) < 2:
        raise HTTPException(400, "Enter your full name")
    if not ident:
        raise HTTPException(400, "Enter your email or phone number")
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    has_at    = "@" in ident
    is_digits = re.sub(r'[\s\-\+\(\)]', '', ident).isdigit()
    if not has_at and not is_digits:
        raise HTTPException(
            400,
            "Enter a valid email (you@gmail.com) or phone number (9876543210)"
        )

    cid = clean_identifier(ident)
    accounts = PreTenantAccounts(get_database())

    # ── Role & organisation ────────────────────────────────────────
    # Registration is public and unauthenticated. The caller can NOT pick a
    # role: `body.role` is still accepted by the model for backward
    # compatibility and is deliberately never read (it once let anyone on
    # the internet mint themselves an admin account).
    #
    # Two paths produce a role, neither of them caller-chosen:
    #
    #   no invite  -> a fresh personal organisation is created for this
    #                 account and it becomes the admin OF THAT ORG ONLY
    #                 (ensure_personal_org, called after insert). This is the
    #                 normal onboarding path — sign up, get your workspace,
    #                 invite your team — with no operator step. It cannot
    #                 touch any existing org: the org is brand new and has
    #                 exactly one member.
    #
    #   with invite -> a server-minted, single-use, expiring token created by
    #                 an authenticated admin (POST /api/admin/invite). It
    #                 decides which existing org the account joins and with
    #                 which role, read from the stored invite record.
    #
    # promote_user.py stays as a fallback for edge cases (e.g. recovering an
    # org whose only admin was demoted). PATCH /api/admin/users/{id}/role is
    # the in-app way to change a role afterward.
    role = USER_ROLE
    invited_org_id: str | None = None
    invite_token = (body.invite or "").strip()
    invite: dict | None = None
    if invite_token:
        invite = await PendingInvites(get_database()).find_valid(invite_token)
        if not invite:
            raise HTTPException(
                400,
                "This invite link is invalid or has expired. "
                "Ask your administrator to send a new one.",
            )
        invited_email = (invite.get("email") or "").lower()
        if invited_email and has_at and cid != invited_email:
            raise HTTPException(
                400,
                f"This invite was sent to {invited_email}. "
                f"Sign up with that email address.",
            )
        role = invite["role"]
        invited_org_id = invite["org_id"]

    # ── Duplicate check ──────────────────────────────────────────
    existing = await accounts.find_by_identifier(cid, ident)
    if existing:
        raise HTTPException(
            400,
            "An account with this email/phone already exists. Please login."
        )

    # ── Create user ──────────────────────────────────────────────
    pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    uid     = str(uuid.uuid4())

    doc = {
        "_id":          uid,
        "name":         name,
        "role":         role,
        "password":     pw_hash,
        "auth_provider": "local",
        "avatar_color": "#6366f1",
        "language":     "en",
        "created_at":   datetime.now(timezone.utc),
        "dob":          "",
        "email":        cid if has_at    else "",
        "phone":        cid if is_digits else "",
    }
    if invited_org_id:
        # Join the inviter's org directly with the invited role. org_id is
        # set here, so ensure_personal_org below is a no-op — no personal
        # org, no admin promotion.
        doc["org_id"] = invited_org_id
    await accounts.insert(doc)
    if invite:
        await PendingInvites(get_database()).mark_accepted(invite_token)

    # Resolve the org now rather than lazily on the first authenticated
    # request, so the token minted just below already carries the final
    # role. For a non-invite signup this creates the account's own
    # organisation and makes it the admin (see ensure_personal_org); for an
    # invite it returns unchanged.
    user_doc = await ensure_personal_org(doc)
    role = user_doc["role"]

    token = make_token(uid, role)
    # Additive since Phase 4: a client that only reads access_token (every
    # client shipped before this) is unaffected. A client that adopts
    # refresh_token gets a revocable, rotating session instead of relying
    # on the now-short-lived access token alone — see core/config.py's
    # ACCESS_TOKEN_EXPIRE_MINUTES comment for why that shortened.
    refresh_token = await token_service.issue_refresh_family(get_database(), uid)

    return {
        "access_token":  token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "role":          role,
        "name":          name,
        "user_id":       uid,
    }


@router.post("/login")
async def login(request: Request, body: LoginBody):
    ident = body.identifier.strip()
    if not ident:
        raise HTTPException(400, "Enter your email or phone")

    # Phase 6: keyed on IP + identifier (see core/rate_limit.py) — checked
    # after the empty-identifier guard so an empty POST doesn't consume a
    # budget slot for nothing, but before the password check, which is the
    # expensive (bcrypt) and sensitive part a credential-stuffing script is
    # actually trying to brute-force.
    login_limiter.check(client_key(request, ident))

    cid = clean_identifier(ident)
    user = await PreTenantAccounts(get_database()).find_by_identifier(cid, ident)

    if not user:
        raise HTTPException(
            401,
            "No account found with this email/phone. Please register first."
        )

    # A Google-only account has no password to check. Tell the person which
    # button to use rather than letting the bcrypt check fail as a generic
    # "wrong password". An account that was created with a password and
    # later linked to Google keeps its hash, so it still logs in here.
    if not user.get("password"):
        raise HTTPException(
            403,
            'This account uses Google sign-in. Use the "Continue with Google" button.',
        )

    try:
        ok = bcrypt.checkpw(body.password.encode(), user["password"].encode())
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(401, "Wrong password. Please try again.")

    # ── Return the role EXACTLY as stored in DB ──────────────────
    # `expected_role` from the body is not consulted here at all. It can
    # never widen access (the token is always signed with `stored_role`),
    # and it no longer narrows access either: a wrong picker selection used
    # to 403, locking someone out of their own account over a mis-click. The
    # client compares its picked role against the `role` we return and, on a
    # mismatch, shows a toast and routes to the correct console.
    stored_role = user.get("role", "user")

    token = make_token(user["_id"], stored_role)
    refresh_token = await token_service.issue_refresh_family(get_database(), user["_id"])

    return {
        "access_token":  token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "role":          stored_role,
        "name":          user["name"],
        "user_id":       user["_id"],
    }


# ── Google Sign-In ───────────────────────────────────────────────────

class GoogleBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The ID token (a JWT) minted by Google Identity Services in the
    # browser. Verified here — signature, issuer, expiry, and audience
    # (our GOOGLE_CLIENT_ID) — before a single field of it is trusted.
    credential: str
    # Optional invite token, same meaning as RegisterBody.invite: lets an
    # invited person accept with Google instead of email/password.
    invite: str | None = None


def _verify_google_credential(credential: str, client_id: str) -> dict:
    """Verify a Google ID token and return its claims.

    Blocking: google-auth fetches (and caches) Google's signing certs over
    HTTPS on first use. Call through run_in_threadpool. Raises ValueError
    on any verification failure — bad signature, wrong audience, expired,
    malformed.
    """
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    return google_id_token.verify_oauth2_token(
        credential, google_requests.Request(), client_id
    )


@router.post("/google")
async def google_auth(request: Request, body: GoogleBody):
    """
    Sign in (or sign up) with a Google ID token.

    After a token is issued the result is indistinguishable from
    /api/auth/login — same response shape, same refresh family, same role
    resolution. The Google-specific work is all up front: verify the
    credential, then find-or-create the account behind its email.
    """
    login_limiter.check(client_key(request, "google:" + (request.client.host if request.client else "")))

    settings = get_settings()
    if not settings.google_signin_enabled:
        raise HTTPException(503, "Google sign-in isn't configured on this server.")

    try:
        idinfo = await run_in_threadpool(
            _verify_google_credential, body.credential, settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(401, "Google sign-in failed. Please try again.")

    # email_verified can arrive as a bool or the string "true" depending on
    # the token — normalise before trusting it.
    verified = idinfo.get("email_verified")
    if verified is False or str(verified).lower() == "false":
        raise HTTPException(403, "Your Google account's email address isn't verified.")

    email = (idinfo.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(401, "Google didn't return an email address.")
    google_name = (idinfo.get("name") or email.split("@")[0]).strip()
    picture = idinfo.get("picture", "")

    db = get_database()
    accounts = PreTenantAccounts(db)
    user = await accounts.find_by_identifier(email, email)

    if user:
        # Same person — link, don't duplicate. Keep any existing password as
        # a fallback login path (see login()).
        if user.get("auth_provider") != "google":
            await accounts.set_auth_provider(user["_id"], "google")
        user = await ensure_personal_org(user)
        uid = user["_id"]
        role = user.get("role", USER_ROLE)
        display_name = user.get("name") or google_name
    else:
        uid = str(uuid.uuid4())
        role = USER_ROLE
        invited_org_id: str | None = None
        invite: dict | None = None
        invite_token = (body.invite or "").strip()
        if invite_token:
            invite = await PendingInvites(db).find_valid(invite_token)
            if not invite:
                raise HTTPException(
                    400,
                    "This invite link is invalid or has expired. "
                    "Ask your administrator to send a new one.",
                )
            invited_email = (invite.get("email") or "").lower()
            if invited_email and invited_email != email:
                raise HTTPException(
                    400,
                    f"This invite was sent to {invited_email}. "
                    f"Sign in with that Google account.",
                )
            role = invite["role"]
            invited_org_id = invite["org_id"]

        doc = {
            "_id":          uid,
            "name":         google_name,
            "role":         role,
            "password":     None,          # no password for a Google account
            "auth_provider": "google",
            "avatar_color": "#6366f1",
            "language":     "en",
            "created_at":   datetime.now(timezone.utc),
            "dob":          "",
            "email":        email,
            "phone":        "",
            "picture":      picture,
        }
        if invited_org_id:
            doc["org_id"] = invited_org_id
        await accounts.insert(doc)
        if invite:
            await PendingInvites(db).mark_accepted(invite_token)
        # No invite → create this account's own organisation and make it the
        # admin of it; with an invite → org_id is already set, so this is a
        # no-op and the invited role stands. Either way, read the role back.
        user = await ensure_personal_org(doc)
        role = user["role"]
        display_name = google_name

    token = make_token(uid, role)
    refresh_token = await token_service.issue_refresh_family(db, uid)

    return {
        "access_token":  token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "role":          role,
        "name":          display_name,
        "user_id":       uid,
    }


# Shown for every /forgot-password call, whatever the outcome. Constant by
# design: a different message for a known vs unknown account turns this
# endpoint into a user-enumeration oracle.
_RESET_ACK = (
    "If an account exists for that email or phone, we've sent a reset link. "
    "Check your inbox, including spam."
)


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: dict):
    """
    Start a password reset. Always 202, always the same body.

    Two holes closed here:

    1. The reset token used to be returned in this response. Anyone who knew
       a person's email or phone could mint a valid token and take the account
       over without ever touching their inbox. The token now leaves the server
       only by email, and is never serialised into an API response.
    2. A missing account used to 404 while a real one returned a token, so the
       endpoint confirmed which emails and phone numbers were registered.

    Delivery is email-only. Until SMTP is configured the flow is inert and no
    token is minted at all — a token that cannot be delivered can only leak.
    """
    settings = get_settings()

    if not settings.password_reset_enabled:
        # Deliberately still 202: we don't advertise which capabilities are
        # switched off. The operator sees the real reason in the log.
        log.warning("password reset requested but SMTP is not configured; flow is disabled")
        return {"message": _RESET_ACK}

    db = get_database()
    ident = (body.get("identifier") or "").strip()
    cid   = clean_identifier(ident)
    user  = await PreTenantAccounts(db).find_by_identifier(cid, cid)

    # `user.get("password")` gates out Google-only accounts: they have no
    # password to reset, and minting them a reset token would be a way to
    # set one and bypass Google entirely. Silent (still a 202) — same
    # oracle-avoidance rule as the unknown-account case.
    if user and user.get("email") and user.get("password"):
        tok = str(uuid.uuid4())
        await ResetTokensRepository(db).create({
            "_id":        tok,
            "user_id":    user["_id"],
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used":       False,
        })
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={tok}"
        # smtplib is blocking; keep it off the event loop.
        await run_in_threadpool(
            send_password_reset_email, user["email"], user.get("name", "there"), reset_url
        )

    return {"message": _RESET_ACK}


@router.post("/reset-password")
async def reset_password(body: dict):
    if not get_settings().password_reset_enabled:
        raise HTTPException(
            503, "Password reset is temporarily unavailable. Please contact your administrator."
        )
    tok = (body.get("token") or "").strip()
    pw  = (body.get("new_password") or "").strip()
    if not tok or len(pw) < 6:
        raise HTTPException(400, "Token and password (min 6 chars) required")

    db = get_database()
    tokens_repo = ResetTokensRepository(db)
    doc = await tokens_repo.find_unused(tok)
    if not doc or doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired token")

    ph = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    await PreTenantAccounts(db).set_password_hash(doc["user_id"], ph)
    await tokens_repo.mark_used(tok)
    return {"message": "Password changed successfully"}


# ── Phase 4: refresh rotation ─────────────────────────────────────────

class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/refresh")
async def refresh(request: Request, body: RefreshBody):
    """
    Exchange a refresh token for a new (access_token, refresh_token) pair.

    Unauthenticated by design — the refresh token itself IS the
    credential, the same way a bearer access token is for every other
    route. Rotation and reuse detection live in services/token_service.py;
    this endpoint only translates that outcome into HTTP and mints the new
    access token once rotation succeeds.
    """
    db = get_database()
    raw = body.refresh_token.strip()
    if not raw:
        raise HTTPException(400, "refresh_token is required")

    # Phase 6: generous budget (see core/rate_limit.py) — legitimate use
    # hits this every time an access token expires, so it only needs to
    # catch a script guessing refresh tokens outright, not slow real
    # traffic down.
    refresh_limiter.check(client_key(request, raw[:24]))

    # Resolved before attempting rotation solely so a reuse-detection
    # evidence entry (if this turns out to be one) is recorded against the
    # right organisation. This lookup grants no authority on its own —
    # token_service re-validates everything independently.
    org_id = None
    pre = await RefreshTokensRepository(db).find_by_hash(hash_token(raw))
    if pre:
        owner = await PreTenantAccounts(db).find_by_id(pre["user_id"])
        if owner:
            owner = await ensure_personal_org(owner)
            org_id = owner.get("org_id")

    try:
        new_refresh, user_id = await token_service.redeem_refresh_token(db, raw, org_id=org_id)
    except token_service.RefreshTokenError as e:
        raise HTTPException(401, str(e))

    user = await PreTenantAccounts(db).find_by_id(user_id)
    if not user:
        raise HTTPException(401, "Account no longer exists.")
    user = await ensure_personal_org(user)

    access = make_token(user_id, user.get("role", "user"))
    return {
        "access_token":  access,
        "refresh_token": new_refresh,
        "token_type":    "bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


class LogoutBody(BaseModel):
    refresh_token: str | None = None


@router.post("/logout")
async def logout(body: LogoutBody):
    """
    Revoke the presented refresh token's whole rotation family. Always 200
    — an already-invalid or missing token is a silent no-op rather than an
    error, matching the oracle-avoidance discipline already used by
    /forgot-password. The access token itself cannot be revoked (it's a
    stateless JWT); it simply expires within
    ACCESS_TOKEN_EXPIRE_MINUTES, which is the whole reason that window is
    now short.
    """
    if body.refresh_token:
        await token_service.revoke_refresh_token(get_database(), body.refresh_token)
    return {"message": "Logged out."}
