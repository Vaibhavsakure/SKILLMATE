"""
Job Match API — Compares resume against job description.
"""

import json
import logging
import hashlib
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.core.database import get_db
from app.api.history import save_analysis
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class JobMatchRequest(BaseModel):
    resume_text: str = Field(..., min_length=20)
    job_description: str = Field(..., min_length=20)


class JobMatchResponse(BaseModel):
    match_score: int
    missing_keywords: List[str]
    recommendation: str


@router.post("/analyze", response_model=JobMatchResponse)
async def match_resume_to_job(
    data: JobMatchRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compares resume text against a job description using AI."""

    # --- Cache lookup (TTL: 30 minutes) ---
    user_id = user.get("id", "anon")
    cache_hash = hashlib.md5((data.resume_text + data.job_description).encode()).hexdigest()
    cache_key = f"jm:{user_id}:{cache_hash}"

    cached = await cache_get(cache_key)
    if cached:
        logger.info(f"Job match cache HIT for user {user_id}")
        return JobMatchResponse(**cached)

    prompt = f"""As a technical recruiter, score this resume vs the job. Be concise. Return JSON only (no markdown).
JOB: {data.job_description[:2000]}
RESUME: {data.resume_text[:2000]}
{{"match_score":<int 0-100>,"missing_keywords":["critical missing skills"],"recommendation":"2-sentence actionable tip"}}"""

    try:
        result = await ai_service.generate_json(prompt)
        logger.info(f"Job match score for user {user_id}: {result.get('match_score', 'N/A')}")

        if not result:
            return JobMatchResponse(
                match_score=0,
                missing_keywords=["Error interpreting AI response"],
                recommendation="Please try again.",
            )

        score = result.get("match_score", 0)

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user_id,
            tool_type="job_match",
            title=f"Job Match (Score: {score}%)",
            input_summary=data.job_description[:200],
            result_data=json.dumps(result),
            score=score,
        )

        response_payload = {
            "match_score": score,
            "missing_keywords": result.get("missing_keywords", []),
            "recommendation": result.get("recommendation", "Consider tailoring your resume further."),
        }

        # --- Store in cache (30 minutes) ---
        await cache_set(cache_key, response_payload, ttl=1800)

        return JobMatchResponse(**response_payload)

    except Exception as e:
        logger.error(f"Job Match Error for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="AI analysis failed")