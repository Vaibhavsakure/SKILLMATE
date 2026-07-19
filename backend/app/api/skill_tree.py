"""
Gamified Skill-Tree API — AI-powered career skill mapping with XP system.
===========================================================================
Analyzes the gap between a student's current skills and their target role,
then generates a visual skill tree with learning resources and XP tracking.
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
class SkillTreeRequest(BaseModel):
    target_role: str = Field(..., min_length=2)
    current_skills: str = Field(..., min_length=10)
    experience_level: str = "beginner"  # beginner, intermediate, advanced


class LearningResource(BaseModel):
    title: str
    url: str
    platform: str  # "YouTube", "Coursera", "Udemy", "freeCodeCamp", "Docs"
    duration: str  # "2 hours", "4 weeks"
    type: str  # "video", "course", "article", "project"


class SkillNode(BaseModel):
    id: str
    name: str
    category: str  # "foundation", "core", "advanced", "specialist"
    status: str  # "mastered", "in_progress", "locked", "recommended"
    xp_reward: int
    current_level: int  # 0-5
    max_level: int  # always 5
    description: str
    prerequisites: List[str]  # list of skill node IDs
    resources: List[LearningResource]


class SkillTreeResponse(BaseModel):
    target_role: str
    total_xp_available: int
    current_xp: int
    mastery_percentage: int
    skill_gap_summary: str
    categories: List[str]
    nodes: List[SkillNode]
    recommended_path: List[str]  # ordered list of skill node IDs


class SkillProgressRequest(BaseModel):
    skill_id: str
    new_level: int


# --- Endpoints ---

@router.post("/generate", response_model=SkillTreeResponse)
async def generate_skill_tree(
    data: SkillTreeRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates a personalized skill tree based on target role and current skills."""

    prompt = f"""
    You are a career development AI specializing in tech skills mapping.

    TARGET ROLE: {data.target_role}
    CURRENT SKILLS: {data.current_skills}
    EXPERIENCE LEVEL: {data.experience_level}

    Generate a comprehensive skill tree with 12-16 skill nodes organized into 4 categories:
    1. "foundation" — prerequisite basics (2-3 nodes)
    2. "core" — essential skills for the role (4-5 nodes)
    3. "advanced" — differentiating skills (3-4 nodes)
    4. "specialist" — expert-level specializations (2-3 nodes)

    For each skill node, determine:
    - Whether the student likely already has it based on their current skills
    - What level (0-5) they're probably at
    - What the prerequisites are (reference other node IDs)

    For learning resources, provide REAL, working URLs to:
    - YouTube tutorials (use youtube.com/results?search_query=... format)
    - Coursera/Udemy courses (use search URLs)
    - Official documentation

    Return JSON:
    {{
        "target_role": "{data.target_role}",
        "total_xp_available": 5000,
        "current_xp": 1200,
        "mastery_percentage": 24,
        "skill_gap_summary": "2-3 sentence gap analysis...",
        "categories": ["foundation", "core", "advanced", "specialist"],
        "recommended_path": ["node_1", "node_2", "node_3"],
        "nodes": [
            {{
                "id": "python_basics",
                "name": "Python Programming",
                "category": "foundation",
                "status": "mastered",
                "xp_reward": 300,
                "current_level": 4,
                "max_level": 5,
                "description": "Core Python syntax, data structures, OOP",
                "prerequisites": [],
                "resources": [
                    {{
                        "title": "Python Full Course for Beginners",
                        "url": "https://youtube.com/results?search_query=python+full+course+beginners",
                        "platform": "YouTube",
                        "duration": "6 hours",
                        "type": "video"
                    }}
                ]
            }}
        ]
    }}

    IMPORTANT:
    - Node IDs must be lowercase_snake_case.
    - Status: "mastered" if current_level >= 4, "in_progress" if level 1-3, "locked" if 0 and has unmet prereqs, "recommended" if 0 and no prereqs.
    - XP rewards: foundation=200-300, core=400-500, advanced=600-800, specialist=800-1000.
    - Return raw JSON only.
    """

    try:
        result = await ai_service.generate_json(prompt)

        nodes = []
        for n in result.get("nodes", []):
            resources = []
            for r in n.get("resources", []):
                resources.append(LearningResource(
                    title=r.get("title", ""),
                    url=r.get("url", "#"),
                    platform=r.get("platform", "Web"),
                    duration=r.get("duration", ""),
                    type=r.get("type", "article"),
                ))
            nodes.append(SkillNode(
                id=n.get("id", ""),
                name=n.get("name", ""),
                category=n.get("category", "core"),
                status=n.get("status", "recommended"),
                xp_reward=n.get("xp_reward", 300),
                current_level=n.get("current_level", 0),
                max_level=n.get("max_level", 5),
                description=n.get("description", ""),
                prerequisites=n.get("prerequisites", []),
                resources=resources,
            ))

        response = SkillTreeResponse(
            target_role=result.get("target_role", data.target_role),
            total_xp_available=result.get("total_xp_available", 5000),
            current_xp=result.get("current_xp", 0),
            mastery_percentage=result.get("mastery_percentage", 0),
            skill_gap_summary=result.get("skill_gap_summary", ""),
            categories=result.get("categories", ["foundation", "core", "advanced", "specialist"]),
            nodes=nodes,
            recommended_path=result.get("recommended_path", []),
        )

        # Save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="skill_tree",
            title=f"Skill Tree: {data.target_role}",
            input_summary=data.current_skills[:200],
            result_data=json.dumps(result),
            score=response.mastery_percentage,
        )

        logger.info(f"Skill tree generated for user {user.get('id')}: {len(nodes)} nodes")
        return response

    except Exception as e:
        logger.error(f"Skill tree error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate skill tree")
