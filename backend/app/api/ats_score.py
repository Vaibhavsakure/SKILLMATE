"""
ATS Score API — Analyzes resume against job description using AI.
"""

import json
import logging
import hashlib
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.utils.file_parser import extract_text_from_file
from app.core.database import get_db
from app.api.history import save_analysis
from app.core.docs import document
from app.core.response_models import SuccessResponse, COMMON_ERRORS, success
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Response Model ---
class ATSResponse(BaseModel):
    score: int
    missing_keywords: List[str]
    suggestions: List[str]


@router.post(
    "/score",
    response_model=SuccessResponse[ATSResponse],
    responses=COMMON_ERRORS,
    **document(
        summary="Scan resume against a job description",
        description=(
            "Uploads a PDF/DOCX resume (or raw text) and a job description, then returns "
            "an ATS compatibility **score 0–100**, a list of **missing keywords**, and "
            "**actionable suggestions** to improve the score.\n\n"
            "Costs **1 credit** per call. The result is auto-saved to analysis history."
        ),
        response_example={
            "score": 78,
            "missing_keywords": ["Kubernetes", "Terraform", "CI/CD"],
            "suggestions": [
                "Add cloud infrastructure certifications",
                "Quantify team leadership impact with metrics",
                "Include specific CI/CD pipeline tools used",
            ],
        },
    ),
)
async def calculate_ats_score(
    request: Request,
    job_description: str = Form(...),
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calculates ATS score for a resume against a job description."""

    final_text = ""
    if resume_file:
        content = await resume_file.read()
        final_text = extract_text_from_file(content, resume_file.filename)
    elif resume_text:
        final_text = resume_text

    if not final_text:
        raise HTTPException(status_code=400, detail="Missing resume data.")

    # --- Cache lookup (TTL: 1 hour) ---
    user_id = user.get("id", "anon")
    cache_hash = hashlib.md5((final_text + job_description).encode()).hexdigest()
    cache_key = f"ats:{user_id}:{cache_hash}"

    cached = await cache_get(cache_key)
    if cached:
        logger.info(f"ATS cache HIT for user {user_id}")
        return success(
            ATSResponse(**cached),
            credits_used=0,
            request=request,
        )

    prompt = f"""Score this resume vs the job description. Be concise. Return JSON only (no markdown).
JOB: {job_description}
RESUME: {final_text[:4000]}
{{"score":<int 0-100>,"missing_keywords":["str"],"suggestions":["str"]}}"""

    try:
        ai_data = await ai_service.generate_json(prompt)
        logger.info(f"ATS score generated for user {user_id}: {ai_data.get('score', 'N/A')}")

        # Validate: ensure suggestions are strings, not objects
        cleaned_suggestions = []
        for item in ai_data.get("suggestions", []):
            if isinstance(item, dict):
                cleaned_suggestions.append(f"{item.get('category', '')}: {item.get('description', '')}")
            else:
                cleaned_suggestions.append(str(item))

        # Validate: ensure missing_keywords are strings
        cleaned_keywords = []
        for item in ai_data.get("missing_keywords", []):
            if isinstance(item, dict):
                cleaned_keywords.append(item.get("keyword", str(item)))
            else:
                cleaned_keywords.append(str(item))

        score = ai_data.get("score", 0)

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user_id,
            tool_type="ats_score",
            title=f"ATS Scan (Score: {score}%)",
            input_summary=job_description[:200],
            result_data=json.dumps(ai_data),
            score=score,
        )

        response_payload = {
            "score": score,
            "missing_keywords": cleaned_keywords,
            "suggestions": cleaned_suggestions,
        }

        # --- Store in cache (1 hour) ---
        await cache_set(cache_key, response_payload, ttl=3600)

        return success(
            ATSResponse(**response_payload),
            credits_used=1,
            request=request,
        )

    except Exception as e:
        logger.error(f"ATS Error for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="ATS analysis failed")