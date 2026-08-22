import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from core.errors import install_error_handlers
from core.uploads import assert_no_static_upload_route
from routes import auth, files, admin, profile, phishing, chatbot

logging.basicConfig(
    level=get_settings().LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

def try_import(name, from_path):
    try:
        import importlib
        mod = importlib.import_module(from_path)
        return mod.router, True
    except Exception as e:
        print(f"[WARN] {name} not loaded: {e}")
        return None, False

app = FastAPI(title="SecureDesk API", version="4.0.0")

settings = get_settings()

# Exact origins only. There is deliberately no allow_origin_regex here: the
# previous pattern matched any *.vercel.app / *.onrender.com / *.netlify.app
# host, and combined with allow_credentials=True that let anyone who could
# deploy a page to Vercel make credentialed calls against this API with a
# signed-in user's cookies and headers. Origins now come from settings, which
# refuses a wildcard in production.
ORIGINS = settings.allowed_origins

install_error_handlers(app)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline hardening headers. The API returns JSON only, so a strict
    CSP and nosniff cost nothing and close off content-sniffing tricks."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    response.headers.setdefault("Cache-Control", "no-store")
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Core — always on (auth never breaks)
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(files.router,    prefix="/api/files",    tags=["Files"])
app.include_router(admin.router,    prefix="/api/admin",    tags=["Admin"])
app.include_router(profile.router,  prefix="/api/profile",  tags=["Profile"])
app.include_router(phishing.router, prefix="/api/phishing", tags=["Phishing"])
app.include_router(chatbot.router,  prefix="/api/chat",     tags=["Chat"])

# Optional modules — skip gracefully if services/ folder missing
optional_routes = [
    ("DLP",           "routes.analyze",       "/api/dlp"),
    ("AI Copilot",    "routes.ai_copilot",    "/api/ai"),
    ("Organization",  "routes.organization",  "/api/org"),
    ("Compliance",    "routes.compliance",    "/api/compliance"),
    ("WhatsApp",      "routes.whatsapp",      "/api/whatsapp"),
    ("Onboarding",    "routes.onboarding",    "/api/onboarding"),
    # ("Billing",     "routes.billing",       "/api/billing"),
    #   Disabled: routes/billing.py reads RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET,
    #   which are set in no environment. /verify guards its HMAC check behind
    #   `if razorpay_secret:` — so with the secret empty the signature check is
    #   skipped entirely and the subscription is written as verified. Any
    #   signed-in user could grant themselves a paid plan. Re-enable only
    #   together with real keys AND after making that check fail closed.
    ("Exports",       "routes.exports",       "/api/export"),
    ("Notifications", "routes.notifications", "/api/notifications"),
]

for name, module_path, prefix in optional_routes:
    router, ok = try_import(name, module_path)
    if ok:
        app.include_router(router, prefix=prefix, tags=[name])

@app.on_event("startup")
async def startup():
    # Fails loudly if anyone ever mounts StaticFiles: uploaded content must
    # never become a fetchable URL.
    assert_no_static_upload_route(app)
    try:
        from ml.classifier import _get_model
        _get_model()
    except Exception as e:
        print(f"[WARN] ML model: {e}")
    print("SecureDesk v4.0 running — auth always active")

@app.get("/")
async def root():
    return {"status": "SecureDesk API v4.0", "docs": "/docs"}
