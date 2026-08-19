"""
AI Achievement Extractor API — Transform weak bullets into power statements.
=============================================================================
Takes resume bullet points and enhances them with quantified metrics,
strong action verbs, and business impact. Returns before/after with
impact scores.
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


# --- Request / Response Models ---

class EnhanceBulletRequest(BaseModel):
    bullet: str = Field(..., min_length=5, description="The original bullet point to enhance")
    job_context: Optional[str] = Field(None, description="Optional job description for context")
    tone: str = Field("professional", description="Tone: professional, confident, technical")


class EnhancedBullet(BaseModel):
    original: str
    enhanced: str
    metrics_added: List[str]
    action_verb_before: str
    action_verb_after: str
    impact_score_before: int  # 1-10
    impact_score_after: int   # 1-10
    reasoning: str
    category: str  # "metrics", "verb_upgrade", "specificity", "quantification"


class EnhanceBulletResponse(BaseModel):
    result: EnhancedBullet
    status: str


class EnhanceAllRequest(BaseModel):
    # min_items/max_items are Pydantic v1 names. Under the pinned Pydantic v2
    # they are not recognised constraints — they were silently dropped into the
    # JSON schema, so the 20-bullet cap was never enforced on the request.
    bullets: List[str] = Field(
        ..., min_length=1, max_length=20, description="List of bullet points"
    )
    job_context: Optional[str] = None
    tone: str = "professional"


class EnhanceAllResponse(BaseModel):
    results: List[EnhancedBullet]
    total_bullets: int
    avg_score_before: float
    avg_score_after: float
    total_improvement: float
    status: str


# --- Single Bullet Enhancement ---

@router.post("/enhance-bullet", response_model=EnhanceBulletResponse)
async def enhance_single_bullet(
    data: EnhanceBulletRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enhances a single resume bullet point with AI-powered metrics and impact."""

    jd_context = f"\nJob Context: {data.job_context[:1000]}" if data.job_context else ""

    prompt = f"""You are an expert resume coach who transforms weak resume bullets into powerful, quantified achievement statements.

Original Bullet Point: "{data.bullet}"
Desired Tone: {data.tone}{jd_context}

Analyze this bullet point and create a dramatically more impactful version.

Rules for enhancement:
1. Start with a STRONG action verb (Architected, Spearheaded, Optimized, Reduced, Increased, Launched, Engineered, Orchestrated, Pioneered)
2. Add SPECIFIC metrics (percentages, dollar amounts, user counts, time saved)
3. Show BUSINESS IMPACT (revenue, efficiency, scale, team size)
4. If the original has no numbers, intelligently estimate realistic metrics
5. Keep it to 1-2 sentences max

Return JSON:
{{
    "original": "{data.bullet}",
    "enhanced": "Your dramatically improved version here",
    "metrics_added": ["50K RPM", "40% reduction", "$2M revenue"],
    "action_verb_before": "the first word of original",
    "action_verb_after": "the first word of enhanced",
    "impact_score_before": 3,
    "impact_score_after": 9,
    "reasoning": "Brief explanation of what was improved and why",
    "category": "metrics"
}}

Categories:
- "metrics" — Added quantifiable numbers
- "verb_upgrade" — Weak verb replaced with strong action verb
- "specificity" — Vague language made concrete
- "quantification" — Added business impact numbers

IMPORTANT: Return raw JSON only. No markdown. Make the enhanced version realistic but impressive.
"""

    try:
        result = await ai_service.generate_json(prompt)

        enhanced = EnhancedBullet(
            original=result.get("original", data.bullet),
            enhanced=result.get("enhanced", data.bullet),
            metrics_added=result.get("metrics_added", []),
            action_verb_before=result.get("action_verb_before", ""),
            action_verb_after=result.get("action_verb_after", ""),
            impact_score_before=max(1, min(10, result.get("impact_score_before", 3))),
            impact_score_after=max(1, min(10, result.get("impact_score_after", 8))),
            reasoning=result.get("reasoning", "Enhanced with metrics and strong verbs"),
            category=result.get("category", "metrics"),
        )

        # Save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="achievement_extractor",
            title=f"Bullet Enhanced ({enhanced.impact_score_before}→{enhanced.impact_score_after})",
            input_summary=data.bullet[:200],
            result_data=json.dumps(result),
            score=enhanced.impact_score_after * 10,
        )

        logger.info(
            f"✨ Bullet enhanced for user {user.get('id')}: "
            f"{enhanced.impact_score_before}→{enhanced.impact_score_after}"
        )

        return EnhanceBulletResponse(result=enhanced, status="success")

    except Exception as e:
        logger.error(f"Achievement extractor error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to enhance bullet point")


# --- Batch Enhancement ---

@router.post("/enhance-all", response_model=EnhanceAllResponse)
async def enhance_all_bullets(
    data: EnhanceAllRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enhances multiple bullet points in batch. Premium feature."""

    jd_context = f"\nJob Context: {data.job_context[:1500]}" if data.job_context else ""

    # Format bullets as numbered list
    bullets_text = "\n".join([f"{i+1}. \"{b}\"" for i, b in enumerate(data.bullets)])

    prompt = f"""You are an expert resume coach. Transform ALL of these weak resume bullets into powerful achievement statements.

BULLET POINTS TO ENHANCE:
{bullets_text}

Desired Tone: {data.tone}{jd_context}

For EACH bullet, create a dramatically improved version following these rules:
1. Start with a STRONG action verb
2. Add SPECIFIC metrics (percentages, dollar amounts, user counts, time saved)
3. Show BUSINESS IMPACT
4. Keep each to 1-2 sentences max
5. Make metrics realistic but impressive

Return JSON:
{{
    "results": [
        {{
            "original": "original bullet text",
            "enhanced": "dramatically improved version",
            "metrics_added": ["50K RPM", "40% reduction"],
            "action_verb_before": "first word of original",
            "action_verb_after": "first word of enhanced",
            "impact_score_before": 3,
            "impact_score_after": 9,
            "reasoning": "what was improved",
            "category": "metrics"
        }}
    ]
}}

IMPORTANT:
- Enhance ALL {len(data.bullets)} bullets
- impact_score range: 1-10
- category: "metrics" | "verb_upgrade" | "specificity" | "quantification"
- Return raw JSON only
"""

    try:
        result = await ai_service.generate_json(prompt)

        enhanced_bullets = []
        for item in result.get("results", []):
            enhanced_bullets.append(EnhancedBullet(
                original=item.get("original", ""),
                enhanced=item.get("enhanced", ""),
                metrics_added=item.get("metrics_added", []),
                action_verb_before=item.get("action_verb_before", ""),
                action_verb_after=item.get("action_verb_after", ""),
                impact_score_before=max(1, min(10, item.get("impact_score_before", 3))),
                impact_score_after=max(1, min(10, item.get("impact_score_after", 8))),
                reasoning=item.get("reasoning", ""),
                category=item.get("category", "metrics"),
            ))

        # Calculate aggregated stats
        if enhanced_bullets:
            avg_before = sum(b.impact_score_before for b in enhanced_bullets) / len(enhanced_bullets)
            avg_after = sum(b.impact_score_after for b in enhanced_bullets) / len(enhanced_bullets)
        else:
            avg_before = 0
            avg_after = 0

        # Save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="achievement_extractor",
            title=f"Batch Enhancement ({len(enhanced_bullets)} bullets)",
            input_summary=f"{len(data.bullets)} bullets enhanced",
            result_data=json.dumps(result),
            score=int(avg_after * 10),
        )

        logger.info(
            f"✨ Batch enhancement for user {user.get('id')}: "
            f"{len(enhanced_bullets)} bullets, avg {avg_before:.1f}→{avg_after:.1f}"
        )

        return EnhanceAllResponse(
            results=enhanced_bullets,
            total_bullets=len(enhanced_bullets),
            avg_score_before=round(avg_before, 1),
            avg_score_after=round(avg_after, 1),
            total_improvement=round(avg_after - avg_before, 1),
            status="success",
        )

    except Exception as e:
        logger.error(f"Batch enhancement error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to enhance bullet points")
