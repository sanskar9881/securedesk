"""
DEPRECATED — kept only so existing imports keep working.

Real configuration now lives in `core/config.py`. This module re-exports the
same names it always did, sourced from the validated Settings object, so
`from config import SECRET_KEY` continues to work unchanged while call sites
are migrated to `from core.config import get_settings`.

Do not add new names here. New code should call get_settings().
"""
from __future__ import annotations

from core.config import get_settings

_s = get_settings()

MONGODB_URL                 = _s.MONGODB_URL
DATABASE_NAME               = _s.DATABASE_NAME
SECRET_KEY                  = _s.SECRET_KEY
ALGORITHM                   = _s.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = _s.ACCESS_TOKEN_EXPIRE_MINUTES
ANTHROPIC_API_KEY           = _s.ANTHROPIC_API_KEY
OPENAI_API_KEY              = _s.OPENAI_API_KEY
FRONTEND_URL                = _s.FRONTEND_URL

__all__ = [
    "MONGODB_URL", "DATABASE_NAME", "SECRET_KEY", "ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
    "FRONTEND_URL",
]
