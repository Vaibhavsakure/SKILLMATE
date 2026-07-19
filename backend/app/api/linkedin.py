"""
LinkedIn Optimization API — Generates headlines, about sections, and skills.
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

router = APIRouter(
    prefix="/linkedin",
    tags=["LinkedIn Optimization"],
)


# --- Schema ---
class LinkedInRequest(BaseModel):
    resume_text: str = Field(..., min_length=50)
    target_role: str = Field(..., description="e.g. Senior Product Manager")
    tone: str = "Professional"


class LinkedInResponse(BaseModel):
    headline: str
    about_section: str
    suggested_skills: List[str]


# --- Endpoint ---
@router.post("/optimize", response_model=LinkedInResponse)
async def generate_linkedin_profile(
    payload: LinkedInRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates a high-impact LinkedIn Headline and About section."""

    prompt = f"""Optimize a LinkedIn profile for: {payload.target_role} ({payload.tone} tone). Be concise. Return JSON only (no markdown).
RESUME: {payload.resume_text[:4000]}
· headline: keyword-rich, <220 chars, use '|' separators
· about_section: first-person, engaging hook, end with CTA
· suggested_skills: 5-7 top skills
{{"headline":"...","about_section":"...","suggested_skills":["..."]}}"""

    try:
        data = await ai_service.generate_json(prompt)
        logger.info(f"LinkedIn profile generated for user {user.get('id')}, role: {payload.target_role}")

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="linkedin_optimization",
            title=f"LinkedIn: {payload.target_role}",
            input_summary=payload.target_role,
            result_data=json.dumps(data),
        )

        return LinkedInResponse(
            headline=data.get("headline", "Could not generate headline"),
            about_section=data.get("about_section", "Could not generate about section"),
            suggested_skills=data.get("suggested_skills", []),
        )

    except Exception as e:
        logger.error(f"LinkedIn Error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="LinkedIn generation failed")