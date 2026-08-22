import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URL, DATABASE_NAME


def create_client(url: str) -> AsyncIOMotorClient:
    """Connect to Mongo, verifying the server certificate.

    tlsAllowInvalidCertificates used to be set here, which disabled
    certificate validation entirely and left every query — credentials,
    user records, activity logs — open to a machine-in-the-middle on the
    path to Atlas. TLS without verification is not TLS.

    tlsCAFile is pinned to the certifi bundle because the system trust
    store is what was missing in the first place — Render's slim Python
    image and stock macOS both ship without the roots Atlas presents, and
    that failure is what the disabled check was papering over.
    """
    if "mongodb+srv" in url or "mongodb.net" in url:
        return AsyncIOMotorClient(
            url,
            tls=True,
            tlsCAFile=certifi.where(),
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
