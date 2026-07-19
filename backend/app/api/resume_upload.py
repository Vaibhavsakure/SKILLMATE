"""
Resume Upload API — Stores uploaded resume files.
==================================================
Storage strategy (chosen at runtime based on config):

  1. Cloud (S3 / R2)  — when S3_BUCKET_NAME is set in .env
     • Calls storage_service.upload_file() → returns a public URL
     • File never touches the local disk

  2. Local fallback   — when S3_BUCKET_NAME is NOT set (development default)
     • Saves to uploads/<uuid><ext> as before
     • Returns a relative file path

The response shape is the same in both cases so callers need no changes.
"""

import os
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_current_user
from app.core.config import settings

logger = logging.getLogger("skillmate.upload")

router = APIRouter()

# --- Constants ---
MAX_FILE_SIZE_MB = settings.max_file_size_mb
ALLOWED_EXTENSIONS = set(settings.allowed_upload_extensions)   # {".pdf", ".docx", ".doc"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


# --- Response model ---
class UploadResponse(BaseModel):
    message: str
    filename: str           # unique storage filename / key
    file_url: str           # public URL (cloud) or local path (dev)
    size_bytes: int
    storage: str            # "s3" | "local"


@router.post("/upload", response_model=UploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Securely uploads a resume (PDF/DOCX).

    • Cloud mode  (S3_BUCKET_NAME set): stores in S3/R2, returns public URL.
    • Local mode  (default / dev):      stores in uploads/, returns file path.

    Enforces extension allowlist, MIME-type check, and file-size limit.
    """
    user_id: str = user.get("id", "anonymous")

    # 1. Validate extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # 2. Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a valid PDF or DOCX.",
        )

    # 3. Read file bytes (with size guard)
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

    # 4. Store — cloud (S3/R2) or local fallback
    if settings.s3_bucket_name:
        # ── Cloud storage ──────────────────────────────────────────────────
        try:
            from app.services.storage_service import storage_service

            file_url = await storage_service.upload_file(
                file_bytes=file_bytes,
                filename=file.filename,
                user_id=user_id,
            )
            # The key is embedded in the URL; use filename portion for display
            unique_filename = file_url.rsplit("/", 1)[-1]
            storage_mode = "s3"
            logger.info(
                f"Resume uploaded to S3 for user {user_id}: "
                f"{file.filename} → {file_url} ({total} bytes)"
            )
        except Exception as exc:
            logger.error(f"S3 upload failed for user {user_id}: {exc}")
            raise HTTPException(status_code=500, detail="Cloud upload failed. Please try again.")

    else:
        # ── Local fallback (development) ───────────────────────────────────
        upload_dir = settings.upload_dir
        os.makedirs(upload_dir, exist_ok=True)

        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_dir, unique_filename)

        try:
            with open(file_path, "wb") as f:
                f.write(file_bytes)
        except Exception as exc:
            logger.error(f"Local file write failed: {exc}")
            raise HTTPException(status_code=500, detail="Could not save file.")

        file_url = file_path   # relative path in dev
        storage_mode = "local"
        logger.info(
            f"Resume saved locally for user {user_id}: "
            f"{file.filename} → {file_path} ({total} bytes)"
        )

    return UploadResponse(
        message="Resume uploaded successfully",
        filename=unique_filename,
        file_url=file_url,
        size_bytes=total,
        storage=storage_mode,
    )