"""
Learning Path API — Skill Gap Analysis with curated learning resources.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.core.database import get_db
from app.api.history import save_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class LearningPathRequest(BaseModel):
    target_role: str = Field(..., min_length=2)
    current_skills: Optional[str] = None
    resume_text: Optional[str] = None


class Resource(BaseModel):
    name: str
    url: str
    type: str  # "free", "paid", "certification"
    platform: str  # "YouTube", "Udemy", "freeCodeCamp", etc.


class SkillGap(BaseModel):
    skill: str
    current_level: str  # "none", "beginner", "intermediate"
    target_level: str  # "intermediate", "advanced", "expert"
    priority: str  # "high", "medium", "low"
    resources: List[Resource]
    estimated_hours: int


class LearningPathResponse(BaseModel):
    role_summary: str
    skill_gaps: List[SkillGap]
    total_estimated_weeks: int
    recommended_order: List[str]


@router.post("/analyze-gaps", response_model=LearningPathResponse)
async def analyze_skill_gaps(
    data: LearningPathRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyzes skill gaps and generates a learning path with curated resources."""

    context = ""
    if data.resume_text:
        context = f"Resume: {data.resume_text[:3000]}"
    elif data.current_skills:
        context = f"Current Skills: {data.current_skills}"
    else:
        context = "Starting from scratch (beginner)."

    prompt = f"""
    Act as a Career Development Expert. Analyze the skill gap between the candidate and their target role.
    
    Target Role: {data.target_role}
    {context}
    
    Return a JSON object with:
    1. "role_summary": Brief motivational summary of the target role
    2. "skill_gaps": List of 4-6 skills to learn, each with:
       - "skill": Name of the skill
       - "current_level": "none", "beginner", or "intermediate"
       - "target_level": "intermediate", "advanced", or "expert"
       - "priority": "high", "medium", or "low"
       - "resources": List of 2-3 learning resources, each with:
         - "name": Resource name (real, specific)
         - "url": Search URL (use google search links or known platform URLs)
         - "type": "free" or "paid" or "certification"
         - "platform": "YouTube", "Udemy", "freeCodeCamp", "Coursera", etc.
       - "estimated_hours": Integer (hours to learn)
    3. "total_estimated_weeks": Total weeks if studying part-time
    4. "recommended_order": List of skill names in recommended learning order
    
    IMPORTANT: Return raw JSON only. Use real, searchable resource names.
    """

    try:
        result = await ai_service.generate_json(prompt)
        logger.info(f"Learning path generated for user {user.get('id')}, role: {data.target_role}")

        # Save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="learning_path",
            title=f"Skill Gap: {data.target_role}",
            input_summary=data.current_skills[:200] if data.current_skills else "From resume",
            result_data=json.dumps(result),
        )

        return LearningPathResponse(**result)

    except Exception as e:
        logger.error(f"Learning path error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate learning path")