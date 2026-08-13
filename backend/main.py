import logging
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from core.errors import install_error_handlers
from core.uploads import assert_no_static_upload_route
from routes import auth, files, admin, profile, phishing, chatbot

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

# Load environment variables from .env file
load_dotenv()

def try_import(name, from_path):
    try:
        import importlib
        mod = importlib.import_module(from_path)
        return mod.router, True
    except Exception as e:
        print(f"[WARN] {name} not loaded: {e}")
        return None, False

app = FastAPI(title="SecureDesk API", version="4.0.0")

ORIGINS = ["http://localhost:5173","http://localhost:5174","http://localhost:3000","http://127.0.0.1:5173","http://127.0.0.1:5174"]
if os.getenv("FRONTEND_URL"): ORIGINS.append(os.getenv("FRONTEND_URL"))

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
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com|netlify\.app)$",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
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
    ("Billing",       "routes.billing",       "/api/billing"),
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
