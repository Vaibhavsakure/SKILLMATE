from typing import Optional
import logging
import traceback
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.utils.file_parser import extract_text_from_file
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ParseResponse(BaseModel):
    text: str
    filename: str
    char_count: int
    error: Optional[str] = None


@router.post("/parse", response_model=ParseResponse)
async def parse_resume_file(
    resume_file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Extracts text from an uploaded PDF, DOCX, or TXT file.
    No AI processing — just raw text extraction for use across tools.
    """
    if not resume_file or not resume_file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    user_id = user.get("id", "anonymous")

    # 1. Size guard — check Content-Length BEFORE reading into memory
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if resume_file.size and resume_file.size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({resume_file.size / (1024*1024):.1f} MB). "
                   f"Maximum allowed: {settings.max_file_size_mb} MB.",
        )

    # 2. Read bytes
    try:
        content = await resume_file.read()
    except Exception as e:
        logger.error(
            "File read failed | user=%s | file='%s' | type=%s | msg=%s",
            user_id, resume_file.filename, type(e).__name__, e,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to read uploaded file.")

    # Defensive size check after read (in case Content-Length header was absent)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / (1024*1024):.1f} MB). "
                   f"Maximum allowed: {settings.max_file_size_mb} MB.",
        )

    # 3. Extract text
    try:
        text = extract_text_from_file(content, resume_file.filename)
    except ValueError as e:
        logger.warning(
            "Unsupported file type | user=%s | file='%s' | msg=%s",
            user_id, resume_file.filename, e,
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(
            "Text extraction failed | user=%s | file='%s' | type=%s | msg=%s",
            user_id, resume_file.filename, type(e).__name__, e,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to parse file")

    # 4. Corrupted PDF / DOCX — file_parser returns "" instead of crashing
    if not text:
        logger.warning(
            "Empty extraction result | user=%s | file='%s' — likely corrupted or image-only.",
            user_id, resume_file.filename,
        )
        return ParseResponse(
            text="",
            filename=resume_file.filename,
            char_count=0,
            error="Could not parse PDF — file may be corrupted, encrypted, or image-only.",
        )

    logger.info(
        "Parsed resume | user=%s | file='%s' | chars=%d",
        user_id, resume_file.filename, len(text),
    )

    return ParseResponse(
        text=text,
        filename=resume_file.filename,
        char_count=len(text),
    )