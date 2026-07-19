"""
User Context API — Save and retrieve global resume + JD.
==========================================================
Users upload their resume and paste JD once. All features
read from this context automatically.
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.utils.file_parser import extract_text_from_file
from app.models.user_context import UserContext

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Response Models ---

class ContextResponse(BaseModel):
    resume_text: Optional[str] = None
    resume_filename: Optional[str] = None
    job_description: Optional[str] = None
    jd_title: Optional[str] = None
    has_resume: bool = False
    has_jd: bool = False
    resume_char_count: int = 0
    jd_char_count: int = 0


class SaveContextRequest(BaseModel):
    resume_text: Optional[str] = None
    job_description: Optional[str] = None
    jd_title: Optional[str] = None


# --- GET: Retrieve user's saved context ---

@router.get("/", response_model=ContextResponse)
async def get_user_context(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the user's saved resume text and job description."""
    user_id = user.get("id")

    ctx = db.query(UserContext).filter(UserContext.user_id == user_id).first()

    if not ctx:
        return ContextResponse()

    return ContextResponse(
        resume_text=ctx.resume_text,
        resume_filename=ctx.resume_filename,
        job_description=ctx.job_description,
        jd_title=ctx.jd_title,
        has_resume=bool(ctx.resume_text and len(ctx.resume_text) > 10),
        has_jd=bool(ctx.job_description and len(ctx.job_description) > 10),
        resume_char_count=len(ctx.resume_text) if ctx.resume_text else 0,
        jd_char_count=len(ctx.job_description) if ctx.job_description else 0,
    )


# --- POST: Save resume text + JD (JSON body) ---

@router.post("/save", response_model=ContextResponse)
async def save_user_context(
    data: SaveContextRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves or updates the user's resume text and/or job description."""
    user_id = user.get("id")

    ctx = db.query(UserContext).filter(UserContext.user_id == user_id).first()

    if not ctx:
        ctx = UserContext(user_id=user_id)
        db.add(ctx)

    # Only update fields that were provided (non-None)
    if data.resume_text is not None:
        ctx.resume_text = data.resume_text
    if data.job_description is not None:
        ctx.job_description = data.job_description
    if data.jd_title is not None:
        ctx.jd_title = data.jd_title

    db.commit()
    db.refresh(ctx)

    logger.info(f"Context saved for user {user_id}: resume={len(ctx.resume_text or '')}chars, jd={len(ctx.job_description or '')}chars")

    return ContextResponse(
        resume_text=ctx.resume_text,
        resume_filename=ctx.resume_filename,
        job_description=ctx.job_description,
        jd_title=ctx.jd_title,
        has_resume=bool(ctx.resume_text and len(ctx.resume_text) > 10),
        has_jd=bool(ctx.job_description and len(ctx.job_description) > 10),
        resume_char_count=len(ctx.resume_text) if ctx.resume_text else 0,
        jd_char_count=len(ctx.job_description) if ctx.job_description else 0,
    )


# --- POST: Upload resume file (multipart) ---

@router.post("/upload-resume", response_model=ContextResponse)
async def upload_resume_to_context(
    resume_file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Uploads a resume file (PDF/DOCX/TXT), extracts text, and saves to context."""

    if not resume_file or not resume_file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    try:
        content = await resume_file.read()
        text = extract_text_from_file(content, resume_file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"File parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse resume file")

    if not text or len(text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Could not extract meaningful text from this file.")

    user_id = user.get("id")
    ctx = db.query(UserContext).filter(UserContext.user_id == user_id).first()

    if not ctx:
        ctx = UserContext(user_id=user_id)
        db.add(ctx)

    ctx.resume_text = text
    ctx.resume_filename = resume_file.filename

    db.commit()
    db.refresh(ctx)

    logger.info(f"Resume uploaded for user {user_id}: {resume_file.filename} ({len(text)} chars)")

    return ContextResponse(
        resume_text=ctx.resume_text,
        resume_filename=ctx.resume_filename,
        job_description=ctx.job_description,
        jd_title=ctx.jd_title,
        has_resume=True,
        has_jd=bool(ctx.job_description and len(ctx.job_description) > 10),
        resume_char_count=len(text),
        jd_char_count=len(ctx.job_description) if ctx.job_description else 0,
    )
