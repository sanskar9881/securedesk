import hashlib, io
from datetime import datetime, timezone
from database import fingerprints_collection


def extract_text(content: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    try:
        if ext == "pdf":
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        elif ext in ("docx", "doc"):
            import docx
            doc = docx.Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        pass
    return content.decode("utf-8", errors="ignore")


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


async def save_fingerprint(
    file_hash: str, filename: str, owner_id: str, owner_name: str,
    file_size: int, risk_level: str, action_taken: str, reasons: list,
    regex_findings: dict,
) -> bool:
    """Store fingerprint. Returns True if duplicate."""
    existing = await fingerprints_collection.find_one({"_id": file_hash})
    if existing:
        await fingerprints_collection.update_one(
            {"_id": file_hash},
            {"$set":  {"last_accessed": datetime.now(timezone.utc)},
             "$push": {"actions_log": {"action": "re-uploaded", "by": owner_name,
                                       "at": datetime.now(timezone.utc).isoformat()}}}
        )
        return True   # duplicate

    await fingerprints_collection.insert_one({
        "_id":           file_hash,
        "filename":      filename,
        "owner_id":      owner_id,
        "owner_name":    owner_name,
        "hash":          file_hash,
        "file_size":     file_size,
        "risk_level":    risk_level,
        "action_taken":  action_taken,
        "reasons":       reasons,
        "regex_findings":regex_findings,
        "created_at":    datetime.now(timezone.utc),
        "last_accessed": datetime.now(timezone.utc),
        "actions_log":   [{"action": "uploaded", "by": owner_name,
                           "at": datetime.now(timezone.utc).isoformat()}],
    })
    return False  # new file
