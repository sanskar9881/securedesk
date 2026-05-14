import os
from dotenv import load_dotenv
load_dotenv()

MONGODB_URL               = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME             = os.getenv("DATABASE_NAME", "cybersec_db")
SECRET_KEY                = os.getenv("SECRET_KEY", "changeme_in_production_very_long_key")
ALGORITHM                 = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
ANTHROPIC_API_KEY         = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY            = os.getenv("OPENAI_API_KEY", "")
FRONTEND_URL              = os.getenv("FRONTEND_URL", "")
