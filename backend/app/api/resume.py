import os
import re
import uuid
import io
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

import pypdf
import docx

from app.api.deps import get_current_user
from app.core.config import settings

logger = logging.getLogger("skillmate.resume")

router = APIRouter(
    prefix="/resume",
    tags=["Resume Upload & Ingest"],
)

# ── Upload directory — always /tmp/uploads inside containers ──────────────────
UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── File constraints ──────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_SIZE = settings.max_file_size_mb * 1024 * 1024  # default 10 MB


# ── Response model ────────────────────────────────────────────────────────────
class UploadResponse(BaseModel):
    message: str
    filename: str
    file_url: str
    text_extracted: str
    # extra detail fields (backwards-compatible)
    file_id: str
    storage: str            # "s3" | "local"
    extracted_text_length: int


# ── Helpers ───────────────────────────────────────────────────────────────────
def _sanitize_filename(name: str) -> str:
    """Keep only alphanumeric, dots, hyphens; collapse underscores."""
    name = re.sub(r"[^A-Za-z0-9.\-]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_") or "upload"


def extract_text_from_pdf(stream: io.BytesIO) -> str:
    reader = pypdf.PdfReader(stream)
    parts = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    return "\n".join(parts).strip()


def extract_text_from_docx(stream: io.BytesIO) -> str:
    doc = docx.Document(stream)
    return "\n".join(p.text for p in doc.paragraphs).strip()


# ── Main endpoint ─────────────────────────────────────────────────────────────
@router.post("/upload", response_model=UploadResponse)
async def upload_and_ingest_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    1. Validates file type and size.
    2. Extracts text (PDF / DOCX / DOC).
    3. Saves to S3/R2 (or /tmp/uploads/ fallback).
    4. Returns file_url + first 500 chars of extracted text.
    """
    user_id: str = user.get("id", "anonymous")

    # ── 1. Extension whitelist ────────────────────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF, DOCX, DOC files allowed. Got: '{file_ext or 'none'}'",
        )

    # ── 2. Pre-read size guard (Content-Length header) ────────────────────────
    if file.size and file.size > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({file.size / (1024*1024):.1f} MB). Max {settings.max_file_size_mb} MB allowed.",
        )

    # ── 3. Read bytes ─────────────────────────────────────────────────────────
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(
            "File read failed | user=%s | file='%s' | type=%s | msg=%s",
            user_id, file.filename, type(e).__name__, e, exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to read uploaded file.")

    # Post-read size guard (catches missing Content-Length)
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents) / (1024*1024):.1f} MB). Max {settings.max_file_size_mb} MB allowed.",
        )

    # ── 4. Text extraction ────────────────────────────────────────────────────
    extracted_text = ""
    try:
        stream = io.BytesIO(contents)
        if file_ext == ".pdf":
            extracted_text = extract_text_from_pdf(stream)
        elif file_ext in (".docx", ".doc"):
            extracted_text = extract_text_from_docx(stream)
    except Exception as e:
        logger.error(
            "File parse error | user=%s | file='%s' | type=%s | msg=%s",
            user_id, file.filename, type(e).__name__, e, exc_info=True,
        )
        raise HTTPException(
            status_code=422,
            detail="Could not read file. Make sure it's a valid PDF or DOCX.",
        )

    if len(extracted_text) < 50:
        logger.warning(
            "Short extraction (%d chars) | user=%s | file='%s' — may be scanned/image-only.",
            len(extracted_text), user_id, file.filename,
        )

    # ── 5. Storage ────────────────────────────────────────────────────────────
    file_uuid = uuid.uuid4().hex
    safe_name = f"{file_uuid}_{_sanitize_filename(file.filename)}"

    if settings.s3_bucket_name:
        # Cloud storage (S3 / Cloudflare R2)
        try:
            from app.services.storage_service import storage_service
            file_url = await storage_service.upload_file(
                file_bytes=contents,
                filename=file.filename,
                user_id=user_id,
            )
            storage_mode = "s3"
            logger.info(
                "Resume uploaded to S3 | user=%s | file='%s' | url=%s | bytes=%d",
                user_id, file.filename, file_url, len(contents),
            )
        except Exception as exc:
            logger.error(
                "S3 upload failed | user=%s | file='%s' | type=%s | msg=%s",
                user_id, file.filename, type(exc).__name__, exc, exc_info=True,
            )
            raise HTTPException(status_code=500, detail="Cloud upload failed. Please try again.")
    else:
        # Local fallback — /tmp/uploads/ is writable in every Docker container
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        try:
            with open(file_path, "wb") as f:
                f.write(contents)
        except Exception as exc:
            logger.error(
                "Local write failed | user=%s | path='%s' | type=%s | msg=%s",
                user_id, file_path, type(exc).__name__, exc, exc_info=True,
            )
            raise HTTPException(status_code=500, detail="Could not save file.")

        file_url = f"/uploads/{safe_name}"
        storage_mode = "local"
        logger.info(
            "Resume saved locally | user=%s | file='%s' | path=%s | bytes=%d",
            user_id, file.filename, file_path, len(contents),
        )

    # ── 6. Response ───────────────────────────────────────────────────────────
    return UploadResponse(
        message="Resume uploaded successfully",
        filename=file.filename,
        file_url=file_url,
        text_extracted=extracted_text[:500] if extracted_text else "",
        file_id=file_uuid,
        storage=storage_mode,
        extracted_text_length=len(extracted_text),
    )


