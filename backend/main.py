from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, files, admin
from routes import profile, phishing, chatbot
from ml.classifier import _get_model

app = FastAPI(title="SecureDesk API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(phishing.router, prefix="/api/phishing", tags=["Phishing"])
app.include_router(chatbot.router, prefix="/api/chat", tags=["Chatbot"])


@app.on_event("startup")
async def startup():
    print("Loading ML model...")
    _get_model()
    print("ML model ready. SecureDesk v2.0 running.")


@app.get("/")
async def root():
    return {"status": "SecureDesk API v2.0 running"}
