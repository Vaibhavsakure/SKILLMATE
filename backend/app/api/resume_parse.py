"""
Resume Parse API — Extracts text from uploaded files (no AI processing).
Used by the shared ResumeUploader component across all tools.
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.utils.file_parser import extract_text_from_file

logger = logging.getLogger(__name__)

router = APIRouter()


class ParseResponse(BaseModel):
    text: str
    filename: str
    char_count: int


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

    try:
        content = await resume_file.read()
        text = extract_text_from_file(content, resume_file.filename)

        logger.info(f"Parsed resume for user {user.get('id')}: {resume_file.filename} ({len(text)} chars)")

        return ParseResponse(
            text=text,
            filename=resume_file.filename,
            char_count=len(text),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse file")