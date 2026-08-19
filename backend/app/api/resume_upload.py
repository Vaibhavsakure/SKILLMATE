"""
Resume Upload API — Stores uploaded resume files.
==================================================
Storage strategy (chosen at runtime based on config):

  1. Cloud (S3 / R2)  — when S3_BUCKET_NAME + credentials are set in .env
     • Calls storage_service.upload_file() → returns a public URL
     • File never touches the local disk
     • URL is saved to the resumes table (Resume.file_url)

  2. Local fallback   — when S3 is not configured (development default)
     • Saves to /tmp/uploads/<uuid><ext>
     • Returns a relative file path
     • Path saved to Resume.file_url (best-effort — lost on restart)

The response shape is identical in both cases.
"""

import os
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from sqlalchemy.orm import Session

logger = logging.getLogger("skillmate.upload")

router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB  = settings.max_file_size_mb
ALLOWED_EXTENSIONS = set(settings.allowed_upload_extensions)   # {".pdf", ".docx", ".doc"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


# ── Response model ─────────────────────────────────────────────────────────
class UploadResponse(BaseModel):
    message: str
    resume_id: Optional[str] = None   # DB row ID (None when DB write is skipped)
    filename: str                     # unique storage filename / key
    file_url: str                     # public URL (cloud) or local path (dev)
    size_bytes: int
    storage: str                      # "s3" | "local"


@router.post("/upload", response_model=UploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Securely uploads a resume (PDF/DOCX) and persists the storage URL to the DB.

    • Cloud mode  (S3_BUCKET_NAME + credentials set): stores in S3/R2, returns public URL.
    • Local mode  (default / dev):  stores in /tmp/uploads/, returns absolute path.

    Enforces extension allowlist, MIME-type check, and file-size limit.
    The URL is written to Resume.file_url so it survives container restarts.
    """
    user_id: str = user.get("id", "anonymous")

    # ── 1. Validate extension ──────────────────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # ── 2. Validate MIME type ──────────────────────────────────────────────
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a valid PDF or DOCX.",
        )

    # ── 3. Read file bytes (streaming with size guard) ─────────────────────
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = await file.read(1024 * 1024)  # 1 MB chunks
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB.",
            )
        chunks.append(chunk)

    file_bytes = b"".join(chunks)

    # ── 4. Store — cloud (S3/R2) or local fallback ────────────────────────
    if settings.s3_is_configured:
        # ── Cloud storage ──────────────────────────────────────────────────
        try:
            from app.services.storage_service import storage_service

            file_url = await storage_service.upload_file(
                file_bytes=file_bytes,
                filename=file.filename,
                user_id=user_id,
            )
            # The key is embedded in the URL; use the last segment as display name
            unique_filename = file_url.rsplit("/", 1)[-1]
            storage_mode = "s3"
            logger.info(
                "Resume uploaded to S3 | user=%s | %s → %s (%d bytes)",
                user_id, file.filename, file_url, total,
            )
        except Exception as exc:
            logger.error("S3 upload failed | user=%s | error=%s", user_id, exc, exc_info=True)
            raise HTTPException(status_code=500, detail="Cloud upload failed. Please try again.")

    else:
        # ── Local fallback (development / no S3 configured) ────────────────
        upload_dir = settings.upload_dir
        os.makedirs(upload_dir, exist_ok=True)

        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_dir, unique_filename)

        try:
            with open(file_path, "wb") as fh:
                fh.write(file_bytes)
        except OSError as exc:
            logger.error("Local file write failed | path=%s | error=%s", file_path, exc)
            raise HTTPException(status_code=500, detail="Could not save file.")

        file_url = file_path
        storage_mode = "local"
        logger.warning(
            "Resume saved locally (no S3) | user=%s | %s → %s (%d bytes) "
            "— file will be lost on container restart",
            user_id, file.filename, file_path, total,
        )

    # ── 5. Persist URL to the database ────────────────────────────────────
    # We store the URL so it survives across deployments. The extracted_text
    # can be backfilled later; we store an empty string as a placeholder if
    # text extraction hasn't happened yet.
    resume_id: Optional[str] = None
    try:
        from app.models.resume import Resume

        resume_record = Resume(
            user_id=user_id,
            filename=file.filename,
            title=os.path.splitext(file.filename)[0][:100],  # Trim to column limit
            extracted_text="",  # Populated by /resume/parse or AI rewrite endpoints
            file_url=file_url,
        )
        db.add(resume_record)
        db.commit()
        db.refresh(resume_record)
        resume_id = resume_record.id
        logger.info("Resume record saved to DB | id=%s | user=%s | url=%s", resume_id, user_id, file_url)
    except Exception as exc:
        # DB failure is non-fatal — the file is already safely stored.
        # Log and continue so the client still gets the URL.
        logger.error(
            "Failed to save Resume record to DB | user=%s | url=%s | error=%s",
            user_id, file_url, exc, exc_info=True,
        )
        db.rollback()

    return UploadResponse(
        message="Resume uploaded successfully",
        resume_id=resume_id,
        filename=unique_filename,
        file_url=file_url,
        size_bytes=total,
        storage=storage_mode,
    )