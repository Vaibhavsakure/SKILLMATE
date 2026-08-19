"""
Cover Letter API — Generates AI-powered cover letters.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service, _claude_client, _claude_model
from app.api.deps import get_current_user
from app.core.database import get_db, SessionLocal
from app.api.history import save_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


class CoverLetterRequest(BaseModel):
    resume_text: str = Field(..., min_length=10)
    job_description: str = Field(..., min_length=10)
    hiring_manager_name: str = "Hiring Manager"
    tone: str = "Professional"


class CoverLetterResponse(BaseModel):
    cover_letter: str


@router.post("/generate", response_model=CoverLetterResponse)
async def generate_cover_letter(
    data: CoverLetterRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates a cover letter using the provided resume and JD."""

    prompt = f"""Write a {data.tone} cover letter. Be concise. Plain text only — no JSON, no markdown.
· Extract candidate name from resume or use 'Candidate'
· Hiring Manager: {data.hiring_manager_name}
JOB: {data.job_description[:3000]}
RESUME: {data.resume_text[:3000]}"""

    try:
        letter = await ai_service.generate_text(prompt)
        logger.info(f"Cover letter generated for user {user.get('id')}")

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="cover_letter",
            title=f"Cover Letter ({data.tone})",
            input_summary=data.job_description[:200],
            result_data=letter,
        )

        return CoverLetterResponse(cover_letter=letter)
    except Exception as e:
        logger.error(f"Cover Letter Error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate cover letter")


@router.post("/generate-stream")
async def generate_cover_letter_stream(
    data: CoverLetterRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams a cover letter token by token."""

    user_id = user.get("id")

    prompt = f"""Write a {data.tone} cover letter. Be concise. Plain text only — no JSON, no markdown.
· Extract candidate name from resume or use 'Candidate'
· Hiring Manager: {data.hiring_manager_name}
JOB: {data.job_description[:3000]}
RESUME: {data.resume_text[:3000]}"""

    if not _claude_client:
        result = await ai_service.generate_text(prompt)
        async def fallback():
            yield result
        return StreamingResponse(fallback(), media_type="text/plain")

    async def stream_generator():
        full_text = ""
        try:
            async with _claude_client.messages.stream(
                model=_claude_model,
                max_tokens=4096,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    full_text += text
                    yield text

            # Own session: the request-scoped `db` belongs to the endpoint
            # call, not to this generator, which runs while the response body
            # is being streamed.
            history_db = SessionLocal()
            try:
                save_analysis(
                    db=history_db,
                    user_id=user_id,
                    tool_type="cover_letter",
                    title=f"Cover Letter ({data.tone})",
                    input_summary=data.job_description[:200],
                    result_data=full_text,
                )
            finally:
                history_db.close()
        except Exception as e:
            logger.error(f"Cover letter stream error: {e}")
            yield f"\n[Error: {str(e)}]"

    return StreamingResponse(stream_generator(), media_type="text/plain")