"""
Project Recommendations API — Gap-filling project suggestions.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.core.database import get_db
from app.api.history import save_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


class ProjectRequest(BaseModel):
    resume_text: str = Field(..., min_length=20)
    job_description: str = Field(..., min_length=20)


class ProjectItem(BaseModel):
    title: str
    description: str
    difficulty: str
    tech_stack: List[str]
    skills_targeted: List[str]


class ProjectResponse(BaseModel):
    projects: List[ProjectItem]


@router.post("/recommend-projects", response_model=ProjectResponse)
async def recommend_projects(
    data: ProjectRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyzes the gap between resume and job description, then recommends
    projects to build those missing skills.
    """

    prompt = f"""Identify 3 portfolio projects to close the skill gap. Be concise. Return JSON only (no markdown).
RESUME: {data.resume_text[:4000]}
JOB: {data.job_description[:4000]}
{{"projects":[{{"title":"<str>","description":"<2-3 sentences>","difficulty":"Beginner|Intermediate|Advanced","tech_stack":["str"],"skills_targeted":["missing skills this project covers"]}}]}}"""

    try:
        response_data = await ai_service.generate_json(prompt)
        logger.info(f"Project recommendations generated for user {user.get('id')}")

        if "projects" not in response_data:
            if isinstance(response_data, list):
                response_data = {"projects": response_data}
            else:
                response_data = {"projects": []}

        # Auto-save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="project_recommendations",
            title="Project Recommendations",
            input_summary=data.job_description[:200],
            result_data=json.dumps(response_data),
        )

        return ProjectResponse(projects=response_data.get("projects", []))
    except Exception as e:
        logger.error(f"Project Recommendation Error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate project recommendations")
