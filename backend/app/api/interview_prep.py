"""
Interview Prep API — Generates AI-powered interview questions.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.core.database import get_db
from app.api.history import save_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class InterviewPrepRequest(BaseModel):
    resume_text: str = Field(..., min_length=20)
    job_title: str = Field(..., min_length=2)


class InterviewPrepResponse(BaseModel):
    technical_questions: List[str]
    behavioral_questions: List[str]


# --- Endpoint ---
@router.post("/generate-questions", response_model=InterviewPrepResponse)
async def generate_interview_questions(
    data: InterviewPrepRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates interview questions tailored to the resume and job title."""

    prompt = f"""Generate interview questions for a {data.job_title} candidate. Be concise. Return JSON only (no markdown).
RESUME: {data.resume_text[:3000]}
{{"technical_questions":["5 hard, resume-specific questions"],"behavioral_questions":["3 experience-based questions"]}}"""

    try:
        result = await ai_service.generate_json(prompt)
        logger.info(f"Interview questions generated for user {user.get('id')}, role: {data.job_title}")

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="interview_prep",
            title=f"Interview Prep: {data.job_title}",
            input_summary=data.job_title,
            result_data=json.dumps(result),
        )

        return InterviewPrepResponse(
            technical_questions=result.get("technical_questions", ["Could not generate questions."]),
            behavioral_questions=result.get("behavioral_questions", ["Could not generate questions."]),
        )
    except Exception as e:
        logger.error(f"Interview Prep Error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate interview questions")