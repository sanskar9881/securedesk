import ssl
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URL, DATABASE_NAME

# Python 3.14 has stricter SSL — this fixes Atlas SSL handshake errors
def create_client(url: str) -> AsyncIOMotorClient:
    if "mongodb+srv" in url or "mongodb.net" in url:
        # Atlas connection — add SSL fix for Python 3.14
        try:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            return AsyncIOMotorClient(
                url,
                tls=True,
                tlsAllowInvalidCertificates=True,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
            )
        except Exception:
            # Final fallback
            return AsyncIOMotorClient(url, tlsAllowInvalidCertificates=True)
    else:
        # Local MongoDB — no SSL needed
        return AsyncIOMotorClient(url)

client = create_client(MONGODB_URL)
db = client[DATABASE_NAME]

users_collection = db["users"]
transactions_collection = db["transactions"]
reset_tokens_collection = db["reset_tokens"]