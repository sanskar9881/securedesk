"""
Watermark Service — embeds invisible metadata into PDF/DOCX files.
Every file gets stamped with: owner, company, timestamp, unique ID.
If file leaks, we can prove who shared it and when.
"""
import io, uuid, hashlib
from datetime import datetime, timezone
from typing import Optional


def watermark_pdf(content: bytes, owner_name: str, company: str, file_id: str) -> bytes:
    """Embed invisible metadata watermark into PDF."""
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        writer = PyPDF2.PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        # Embed metadata
        writer.add_metadata({
            "/SecureDesk_Owner":   owner_name,
            "/SecureDesk_Company": company, 
            "/SecureDesk_FileID":  file_id,
            "/SecureDesk_Stamped": datetime.now(timezone.utc).isoformat(),
            "/SecureDesk_Hash":    hashlib.sha256(content).hexdigest()[:16],
        })
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        return content  # return original if watermarking fails


def watermark_docx(content: bytes, owner_name: str, company: str, file_id: str) -> bytes:
    """Embed core properties watermark into DOCX."""
    try:
        import docx, io as _io
        doc = docx.Document(_io.BytesIO(content))
        # Add to core properties
        doc.core_properties.author   = f"{owner_name} | {company}"
        doc.core_properties.comments = f"SecureDesk ID:{file_id} | {datetime.now(timezone.utc).isoformat()}"
        doc.core_properties.keywords = f"securedesk:{file_id}"
        out = _io.BytesIO()
        doc.save(out)
        return out.getvalue()
    except Exception:
        return content


def add_visible_watermark_text(content: bytes, filename: str,
                                owner_name: str, company: str) -> bytes:
    """Add visible footer text to PDF pages: CONFIDENTIAL — Owner — Company."""
    try:
        import PyPDF2
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        reader  = PyPDF2.PdfReader(io.BytesIO(content))
        writer  = PyPDF2.PdfWriter()
        wm_text = f"CONFIDENTIAL | {owner_name} | {company} | {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        for page in reader.pages:
            packet = io.BytesIO()
            c = canvas.Canvas(packet, pagesize=A4)
            c.setFont("Helvetica", 7)
            c.setFillColorRGB(0.7, 0.7, 0.7)
            c.drawString(30, 10, wm_text)
            c.save()
            packet.seek(0)
            wm_page = PyPDF2.PdfReader(packet).pages[0]
            page.merge_page(wm_page)
            writer.add_page(page)
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        return content


def apply_watermark(content: bytes, filename: str, owner_name: str,
                    company: str, file_id: str, visible: bool = False) -> bytes:
    """Main entry — detect file type and apply appropriate watermark."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        result = watermark_pdf(content, owner_name, company, file_id)
        if visible:
            result = add_visible_watermark_text(result, filename, owner_name, company)
        return result
    elif ext in ("docx", "doc"):
        return watermark_docx(content, owner_name, company, file_id)
    return content  # TXT, CSV etc — return as-is
