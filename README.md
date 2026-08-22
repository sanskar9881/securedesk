# SecureDesk

B2B Data Loss Prevention for Indian SMEs. Intercepts files shared through
WhatsApp Web and browser uploads, inspects them for Indian personal data
(PAN, Aadhaar, IFSC, bank accounts, credit cards, phone numbers), makes an
allow/warn/block decision, and writes a tamper-evident evidence record.

- `backend/` — FastAPI + MongoDB (deployed to Render)
- `frontend/` — React + TypeScript (deployed to Vercel)

## Running the backend locally

```bash
cd backend
python3.11 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env      # then fill in the values below
./run.sh
```

## Configuration

All environment variables are declared in [`backend/core/config.py`](backend/core/config.py).
Nothing else in the codebase reads `os.getenv` for application config.

The app **refuses to start** when a required secret is missing, is a known
placeholder, or is too weak — a security product that boots with
`SECRET_KEY=changeme` is worse than one that will not boot, because the
first looks healthy. Generate a real secret with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

`ENVIRONMENT` must be `production` on Render. It gates the production
guards: exact-origin CORS, no localhost Mongo, no error detail in
responses, and (once the evidence chain lands) a required signing key.
With it unset the service boots in development mode and none of those
checks engage.

### CORS — Vercel preview deploys are blocked

`CORS_ORIGINS` is an **exact** allowlist and rejects wildcards in
production. `https://securedesk-beige.vercel.app` is the permanent
production origin.

This means **Vercel preview deployments (`securedesk-*-<hash>.vercel.app`)
cannot call the production API.** That is deliberate. The previous config
used a regex matching any `*.vercel.app`, `*.onrender.com` or
`*.netlify.app` host alongside `allow_credentials=True`, which let anyone
who could deploy a page to Vercel — that is, anyone — make credentialed
cross-origin requests against the API using a signed-in user's
credentials.

To test a preview build, point it at a local or staging backend via
`VITE_API_URL` rather than widening the production allowlist. When the
Chrome extension ships, add its `chrome-extension://<id>` origin to
`CORS_ORIGINS` explicitly.

## Roles

Registration is public, so it always creates a plain `user`. Role
elevation is a separate authenticated, admin-only operation:

```
PATCH /api/admin/users/{user_id}/role
```

A fresh install has no admin and no way to make one over the API. Bootstrap
the first one from a shell with database access:

```bash
cd backend
./venv/bin/python -m scripts.promote_user founder@company.in admin
```

`/api/auth/register` still accepts a `role` field from older clients and
deliberately ignores it, so a stale frontend gets a normal account rather
than an error.

## Billing

The billing router is **unmounted** in `main.py`. Self-serve checkout is
off the roadmap; first customers are invoiced manually.

Before those routes are ever mounted again, payment verification must fail
closed — no gateway secret means reject, never skip — and demo mode must
stay a server-side decision rather than something a request can ask for.
Both guards are implemented in `routes/billing.py`; the router is simply
not wired up.

## Password reset

Disabled until `SMTP_EMAIL` and `SMTP_PASSWORD` are configured. The reset
token is a bearer credential for the account, so it is only ever delivered
by email and is never returned in an API response. With no delivery
channel, `/forgot-password` mints no token at all and `/reset-password`
returns 503.

## Operational scripts

```bash
cd backend
./venv/bin/python -m scripts.promote_user <email-or-phone> <role>   # grant a role
./venv/bin/python -m scripts.tenancy_audit                          # read-only tenancy report
```

Point either at another database without editing `.env`:

```bash
MONGODB_URL='mongodb+srv://...' DATABASE_NAME=cybersec_db \
  ./venv/bin/python -m scripts.tenancy_audit
```
