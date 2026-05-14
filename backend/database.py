import ssl
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URL, DATABASE_NAME

def create_client(url: str) -> AsyncIOMotorClient:
    if "mongodb+srv" in url or "mongodb.net" in url:
        return AsyncIOMotorClient(
            url,
            tls=True,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
        )
    return AsyncIOMotorClient(url)

client = create_client(MONGODB_URL)
db     = client[DATABASE_NAME]

users_collection          = db["users"]
transactions_collection   = db["transactions"]
reset_tokens_collection   = db["reset_tokens"]
fingerprints_collection   = db["fingerprinted_files"]
activity_collection       = db["activity_logs"]
alerts_collection         = db["alerts"]
