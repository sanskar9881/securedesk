import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, files, admin, profile, phishing, chatbot, analyze, ai_copilot
from ml.classifier import _get_model

app = FastAPI(title="SecureDesk DLP API", version="3.0.0")

ORIGINS = [
    "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173",
]
if os.getenv("FRONTEND_URL"):
    ORIGINS.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com|netlify\.app)$",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",     tags=["Auth"])
app.include_router(files.router,       prefix="/api/files",    tags=["Files"])
app.include_router(admin.router,       prefix="/api/admin",    tags=["Admin"])
app.include_router(profile.router,     prefix="/api/profile",  tags=["Profile"])
app.include_router(phishing.router,    prefix="/api/phishing", tags=["Phishing"])
app.include_router(chatbot.router,     prefix="/api/chat",     tags=["Chat"])
app.include_router(analyze.router,     prefix="/api/dlp",      tags=["DLP"])
app.include_router(ai_copilot.router,  prefix="/api/ai",       tags=["AI Copilot"])

@app.on_event("startup")
async def startup():
    _get_model()
    print("SecureDesk v3.0 DLP Platform — running")

@app.get("/")
async def root():
    return {"status": "SecureDesk API v3.0", "docs": "/docs"}