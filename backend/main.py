import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, files, admin
from routes import profile, phishing, chatbot
from ml.classifier import _get_model

app = FastAPI(title="SecureDesk API", version="2.0.0")

# ── CORS — allow local dev + production Vercel URL ─────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

# Add production URL from env if set
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# Also allow all vercel.app and render.com subdomains for easy deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com|netlify\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(files.router,    prefix="/api/files",    tags=["Files"])
app.include_router(admin.router,    prefix="/api/admin",    tags=["Admin"])
app.include_router(profile.router,  prefix="/api/profile",  tags=["Profile"])
app.include_router(phishing.router, prefix="/api/phishing", tags=["Phishing"])
app.include_router(chatbot.router,  prefix="/api/chat",     tags=["Chatbot"])


@app.on_event("startup")
async def startup():
    print("Loading ML model...")
    _get_model()
    print("ML model ready. SecureDesk v2.0 running.")


@app.get("/")
async def root():
    return {"status": "SecureDesk API v2.0 running", "docs": "/docs"}