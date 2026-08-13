"""
Upload validation.

Three independent checks, because any one of them alone is bypassable:

  1. SIZE   — enforced while streaming, so an oversized upload is rejected
              before it is ever fully resident in memory. A check performed
              after `await file.read()` is not a limit, it is a report.
  2. TYPE   — the declared extension and the declared Content-Type are both
              treated as untrusted hints. The real check is the magic-byte
              signature of the bytes themselves.
  3. CONTENT— the sniffed type must be on the allowlist AND must agree with the
              declared extension, so `payload.exe` renamed to `report.pdf` is
              rejected rather than silently parsed.

Storage: SecureDesk does not persist uploaded bytes at all. Files are analysed
in memory and only a SHA-256 fingerprint plus metadata is retained. There is no
upload directory, and the app mounts no StaticFiles route, so an uploaded file
has no URL and no execution path. `assert_no_static_upload_route()` keeps that
property from silently regressing.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile

log = logging.getLogger("securedesk.upload")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 10 MB
CHUNK = 64 * 1024

# Magic-byte signatures. (offset, signature) -> canonical kind.
_SIGNATURES: list[tuple[int, bytes, str]] = [
    (0, b"%PDF-", "pdf"),
    (0, b"PK\x03\x04", "zip"),        # docx/xlsx/pptx are zip containers
    (0, b"PK\x05\x06", "zip"),
    (0, b"PK\x07\x08", "zip"),
    (0, b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "ole"),  # legacy .doc/.xls
]

# Signatures that must NEVER be accepted, whatever the file is called.
_EXECUTABLE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"MZ", "Windows executable"),
    (b"\x7fELF", "Linux executable"),
    (b"\xca\xfe\xba\xbe", "Mach-O/Java class"),
    (b"\xcf\xfa\xed\xfe", "Mach-O executable"),
    (b"\xce\xfa\xed\xfe", "Mach-O executable"),
    (b"#!", "script with shebang"),
    (b"\x1f\x8b", "gzip archive"),
    (b"Rar!", "RAR archive"),
    (b"7z\xbc\xaf\x27\x1c", "7-Zip archive"),
]

# ext -> the kinds whose bytes are acceptable for that extension
_ALLOWED: dict[str, set[str]] = {
    "pdf":  {"pdf"},
    "docx": {"zip"},
    "xlsx": {"zip"},
    "pptx": {"zip"},
    "doc":  {"ole", "text"},
    "xls":  {"ole", "text"},
    "txt":  {"text"},
    "csv":  {"text"},
    "log":  {"text"},
    "json": {"text"},
    "md":   {"text"},
}


@dataclass(frozen=True)
class ValidatedUpload:
    content: bytes
    filename: str
    extension: str
    kind: str
    size: int


def _safe_name(raw: str | None) -> str:
    """Strip any path component — an upload never dictates a filesystem path."""
    name = (raw or "unknown").replace("\\", "/").rsplit("/", 1)[-1].strip()
    name = name.replace("\x00", "")
    return name[:200] or "unknown"


def _sniff(head: bytes) -> str:
    for offset, sig, kind in _SIGNATURES:
        if head[offset:offset + len(sig)] == sig:
            return kind
    # Treat as text only if it actually decodes and holds no NUL bytes.
    if b"\x00" in head[:8192]:
        return "binary"
    try:
        head[:8192].decode("utf-8")
        return "text"
    except UnicodeDecodeError:
        try:
            head[:8192].decode("latin-1")
            return "text"
        except UnicodeDecodeError:
            return "binary"


def _reject_executable(head: bytes) -> None:
    for sig, label in _EXECUTABLE_SIGNATURES:
        if head.startswith(sig):
            log.warning("upload_rejected_executable kind=%s", label)
            raise HTTPException(
                status_code=415,
                detail="That file type can't be scanned. Upload a document, spreadsheet, or text file.",
            )


async def read_validated_upload(
    file: UploadFile,
    *,
    max_bytes: int = MAX_UPLOAD_BYTES,
    allowed_extensions: set[str] | None = None,
) -> ValidatedUpload:
    """
    Stream the upload, enforcing the size ceiling as we go, then validate the
    bytes. Raises HTTPException with a user-safe message on any failure.
    """
    filename = _safe_name(file.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    allowed = allowed_extensions if allowed_extensions is not None else set(_ALLOWED)
    if ext not in allowed:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(allowed))}.",
        )

    # ── 1. size, enforced during the read ────────────────────────────
    buf = bytearray()
    while True:
        chunk = await file.read(CHUNK)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            log.warning("upload_rejected_too_large name=%r", filename)
            raise HTTPException(
                status_code=413,
                detail=f"That file is larger than the {max_bytes // (1024 * 1024)} MB limit.",
            )
    content = bytes(buf)

    if not content:
        raise HTTPException(status_code=400, detail="That file is empty.")

    head = content[:8192]

    # ── 2. never accept anything executable ──────────────────────────
    _reject_executable(head)

    # ── 3. sniffed content must agree with the declared extension ────
    kind = _sniff(head)
    expected = _ALLOWED.get(ext, set())
    if kind not in expected:
        log.warning("upload_rejected_mismatch name=%r ext=%s sniffed=%s", filename, ext, kind)
        raise HTTPException(
            status_code=415,
            detail=f"That file's contents don't match its .{ext} extension.",
        )

    return ValidatedUpload(content=content, filename=filename, extension=ext, kind=kind, size=len(content))


def assert_no_static_upload_route(app) -> None:
    """
    Guard the 'uploads are never reachable as a URL' property. Uploaded bytes
    are never written to disk today; if someone later mounts StaticFiles, this
    fails loudly at startup instead of quietly creating an execution path.
    """
    try:
        from starlette.staticfiles import StaticFiles
    except Exception:  # pragma: no cover
        return
    for route in getattr(app, "routes", []):
        if isinstance(getattr(route, "app", None), StaticFiles):
            raise RuntimeError(
                f"StaticFiles is mounted at {getattr(route, 'path', '?')}. Uploaded content must "
                "never be served from a URL. Serve it through an authenticated route instead."
            )
