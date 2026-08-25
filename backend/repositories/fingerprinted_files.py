"""FingerprintedFilesRepository — SHA-256 fingerprints of scanned files.

Named after the collection rather than shortened to `files.py`, so it
isn't confused with routes/files.py (the file-upload/DLP route module).
"""
from __future__ import annotations

from repositories.base import TenantScopedRepository


class FingerprintedFilesRepository(TenantScopedRepository):
    collection_name = "fingerprinted_files"
