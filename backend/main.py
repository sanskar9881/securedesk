import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, files, admin, profile, phishing, chatbot

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
    try:
        from ml.classifier import _get_model
        _get_model()
    except Exception as e:
        print(f"[WARN] ML model: {e}")
    print("SecureDesk v4.0 running — auth always active")

@app.get("/")
async def root():
    return {"status": "SecureDesk API v4.0", "docs": "/docs"}
