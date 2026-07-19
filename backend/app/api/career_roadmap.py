"""
Career Roadmap API — Generates step-by-step career roadmaps.
"""

import json
import logging
import hashlib
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service, _claude_client, _claude_model
from app.api.deps import get_current_user
from app.core.database import get_db
from app.api.history import save_analysis
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class RoadmapRequest(BaseModel):
    target_role: str = Field(..., min_length=2)
    current_skills: Optional[str] = None


class Milestone(BaseModel):
    step_number: int
    title: str
    description: str
    resources: List[str]
    estimated_weeks: str


class RoadmapResponse(BaseModel):
    role_summary: str
    milestones: List[Milestone]


# --- Endpoint ---
@router.post("/generate", response_model=RoadmapResponse)
async def generate_career_roadmap(
    data: RoadmapRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates a step-by-step career roadmap from current skills to target role."""

    # --- Cache lookup (TTL: 24 hours) ---
    # Key includes target_role + current_skills so different skill bases get separate entries
    user_id = user.get("id", "anon")
    role_slug = hashlib.md5(
        (data.target_role + (data.current_skills or "")).encode()
    ).hexdigest()[:16]
    cache_key = f"roadmap:{user_id}:{role_slug}"

    cached = await cache_get(cache_key)
    if cached:
        logger.info(f"Roadmap cache HIT for user {user_id}, role: {data.target_role}")
        return RoadmapResponse(**cached)

    skills_context = (
        f"Current Skills/Background: {data.current_skills}"
        if data.current_skills
        else "Starting from scratch/beginner."
    )

    prompt = f"""Create a learning roadmap to become: {data.target_role}. Be concise. Return JSON only (no markdown).
CURRENT SKILLS: {skills_context}
{{
  "role_summary":"<1-sentence motivational summary>",
  "milestones":[{{"step_number":<int>,"title":"<short action title>","description":"<2 sentences: what to learn and why>","resources":["<2 trusted sources or search terms>"],"estimated_weeks":"<e.g. 2-4 weeks>"}}]
}}
· 4-6 milestones total"""

    try:
        response_data = await ai_service.generate_json(prompt)
        logger.info(f"Career roadmap generated for user {user_id}, role: {data.target_role}")

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user_id,
            tool_type="career_roadmap",
            title=f"Roadmap: {data.target_role}",
            input_summary=data.current_skills[:200] if data.current_skills else "From scratch",
            result_data=json.dumps(response_data),
        )

        # --- Store in cache (24 hours) ---
        await cache_set(cache_key, response_data, ttl=86400)

        return RoadmapResponse(**response_data)
    except Exception as e:
        logger.error(f"Roadmap Gen Error for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate roadmap")
