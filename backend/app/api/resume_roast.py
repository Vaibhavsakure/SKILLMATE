"""
Resume Roast API — Brutally honest, funny, but constructive resume feedback.
==============================================================================
Combines the ATS scoring engine with AI-generated roast commentary to produce
a shareable "Roast Score Card" that users can post on social media.

Costs: 1 credit per roast.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.services.ats_engine import ats_score_engine
from app.api.deps import get_current_user
from app.services.credit_service import check_and_record_quota, record_usage
from app.utils.file_parser import extract_text_from_file
from app.core.database import get_db
from app.api.history import save_analysis
from app.core.docs import document
from app.core.response_models import SuccessResponse, COMMON_ERRORS, success

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
#  Response Models
# ---------------------------------------------------------------------------

class CategoryScore(BaseModel):
    name: str
    score: int          # 0-100
    emoji: str
    roast_line: str     # one-liner per category


class RoastResponse(BaseModel):
    roast_grade: str            # "Well Done 🔥", "Medium Rare 🥩", "Raw 🩸", etc.
    roast_emoji: str            # single emoji for the grade
    overall_score: int          # 0-100 (higher = better resume, less roast-worthy)
    headline: str               # punchy one-liner headline
    roast_lines: List[str]      # 5-7 brutal but funny observations
    category_scores: List[CategoryScore]
    real_talk: List[str]        # 3 genuinely helpful improvement tips
    ats_score: int              # actual ATS score from the engine
    share_text: str             # pre-built tweet/post text


# ---------------------------------------------------------------------------
#  Grade thresholds
# ---------------------------------------------------------------------------

def _compute_grade(score: int) -> dict:
    """Map an overall score to a roast grade."""
    if score >= 85:
        return {"grade": "Rare — Almost Perfect", "emoji": "👨‍🍳"}
    elif score >= 70:
        return {"grade": "Medium Rare", "emoji": "🥩"}
    elif score >= 55:
        return {"grade": "Medium — Needs Seasoning", "emoji": "🍳"}
    elif score >= 40:
        return {"grade": "Well Done — Overcooked", "emoji": "🔥"}
    else:
        return {"grade": "Charcoal — Burnt to a Crisp", "emoji": "💀"}


# ---------------------------------------------------------------------------
#  AI Prompt
# ---------------------------------------------------------------------------

ROAST_PROMPT = """You are the Gordon Ramsay of resumes. You've reviewed 10,000+ resumes and you're brutally honest but ultimately helpful.

Analyze this resume and produce a JSON response. Be FUNNY, SPECIFIC, and SAVAGE — but every roast should contain a kernel of truth that helps the person improve.

RESUME TEXT:
{resume_text}

{jd_section}

Return ONLY valid JSON (no markdown fences) with this EXACT structure:
{{
  "headline": "A punchy one-liner summary of the resume (e.g. 'This resume has more buzzwords than a LinkedIn influencer convention')",
  "roast_lines": [
    "5-7 specific, funny observations about THIS resume (not generic). Reference actual content you see.",
    "Example: 'You listed Microsoft Word as a skill. In 2026. That's like putting breathing on your resume.'",
    "Each line should be 1-2 sentences max.",
    "Be specific — mention actual things from the resume.",
    "Last line should be slightly encouraging."
  ],
  "category_scores": [
    {{"name": "Buzzword Bingo", "score": 45, "emoji": "🎰", "roast_line": "Your resume reads like you swallowed a tech blog and sneezed."}},
    {{"name": "Impact vs. Fluff", "score": 30, "emoji": "💨", "roast_line": "Lots of responsibilities listed, zero evidence you were good at them."}},
    {{"name": "Quantification Game", "score": 55, "emoji": "📊", "roast_line": "Some numbers, but 'managed a team' could mean 2 interns or 200 engineers."}},
    {{"name": "Cliché Meter", "score": 20, "emoji": "😴", "roast_line": "Team player, detail-oriented, self-starter — the holy trinity of saying nothing."}},
    {{"name": "First Impression", "score": 60, "emoji": "👀", "roast_line": "The formatting is clean. That's where the compliments end."}}
  ],
  "real_talk": [
    "3 genuinely actionable, specific improvement tips based on THIS resume.",
    "Be constructive here — no jokes, just real advice.",
    "Reference specific sections or content from the resume."
  ]
}}

IMPORTANT RULES:
- Every roast_line MUST reference something SPECIFIC from the resume text
- Category scores should be 0-100 (be harsh but fair)
- real_talk should be genuinely helpful (no jokes)
- Keep each roast_line under 150 characters
- Return ONLY the JSON object, no explanation"""


# ---------------------------------------------------------------------------
#  Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/roast",
    response_model=SuccessResponse[RoastResponse],
    responses=COMMON_ERRORS,
    **document(
        summary="🔥 Roast My Resume — brutally honest AI feedback",
        description=(
            "Uploads a resume and receives a brutally honest, funny, but constructive "
            "'roast' of the resume. Returns a **Roast Grade**, category scores, "
            "savage one-liners, and genuinely helpful tips.\n\n"
            "The response includes a pre-built `share_text` for posting on "
            "Twitter/LinkedIn for viral sharing.\n\n"
            "Costs **1 credit** per roast."
        ),
        response_example={
            "roast_grade": "Well Done — Overcooked 🔥",
            "roast_emoji": "🔥",
            "overall_score": 42,
            "headline": "This resume has more buzzwords than a LinkedIn influencer convention",
            "roast_lines": [
                "You listed 'Microsoft Office' as a skill. Bold move in 2026.",
                "Your summary says 'passionate team player'. So does everyone else's.",
            ],
            "category_scores": [
                {"name": "Buzzword Bingo", "score": 35, "emoji": "🎰",
                 "roast_line": "Synergy, leverage, and paradigm-shift walk into a bar..."},
            ],
            "real_talk": [
                "Replace 'managed projects' with specific outcomes and metrics",
            ],
            "ats_score": 54,
            "share_text": "My resume just got roasted by AI 🔥 Score: 42/100...",
        },
    ),
)
async def roast_resume(
    request: Request,
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    user: dict = Depends(check_and_record_quota),
    db: Session = Depends(get_db),
):
    """Generate a brutally honest AI roast of a resume."""

    # 1. Extract resume text
    final_text = ""
    if resume_file:
        content = await resume_file.read()
        final_text = extract_text_from_file(content, resume_file.filename)
    elif resume_text:
        final_text = resume_text

    if not final_text or len(final_text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Resume too short or empty. Please provide actual resume content.",
        )

    user_id = user.get("id", "anon")

    # 2. Get real ATS score (if JD provided)
    ats_result = None
    if job_description and job_description.strip():
        try:
            ats_result = ats_score_engine(final_text, job_description)
        except Exception as e:
            logger.warning(f"ATS engine failed during roast (non-critical): {e}")

    ats_score = ats_result["ats_score"] if ats_result else 0

    # 3. Build JD context for prompt
    jd_section = ""
    if job_description and job_description.strip():
        jd_section = f"JOB DESCRIPTION (score the resume against this too):\n{job_description[:2000]}"

    # 4. Generate AI roast
    prompt = ROAST_PROMPT.format(
        resume_text=final_text[:4000],
        jd_section=jd_section,
    )

    try:
        ai_data = await ai_service.generate_json(prompt)

        # 5. Calculate overall score from category averages
        categories_raw = ai_data.get("category_scores", [])
        category_scores = []
        for cat in categories_raw[:5]:  # Cap at 5 categories
            category_scores.append(CategoryScore(
                name=cat.get("name", "Unknown"),
                score=max(0, min(100, int(cat.get("score", 50)))),
                emoji=cat.get("emoji", "📋"),
                roast_line=str(cat.get("roast_line", ""))[:200],
            ))

        if category_scores:
            overall_score = round(sum(c.score for c in category_scores) / len(category_scores))
        else:
            overall_score = 50

        # Factor in ATS score if available (30% ATS, 70% AI categories)
        if ats_score > 0:
            overall_score = round(overall_score * 0.7 + ats_score * 0.3)

        overall_score = max(0, min(100, overall_score))

        # 6. Compute grade
        grade_info = _compute_grade(overall_score)

        # 7. Clean roast lines
        roast_lines = []
        for line in ai_data.get("roast_lines", [])[:7]:
            cleaned = str(line).strip().strip('"').strip("'")
            if len(cleaned) > 10:  # Skip tiny/empty lines
                roast_lines.append(cleaned[:300])

        if not roast_lines:
            roast_lines = ["Your resume exists. That's... a start. 🫠"]

        # 8. Clean real talk
        real_talk = []
        for tip in ai_data.get("real_talk", [])[:3]:
            cleaned = str(tip).strip()
            if len(cleaned) > 10:
                real_talk.append(cleaned[:500])

        if not real_talk:
            real_talk = ["Add quantifiable metrics to every bullet point."]

        # 9. Build share text
        share_text = (
            f"My resume just got roasted by AI 🔥\n"
            f"Score: {overall_score}/100 — {grade_info['grade']}\n\n"
            f"Try it yourself 👉 skillmate.ai/dashboard/resume-roast"
        )

        headline = str(ai_data.get("headline", "This resume... has potential. Deeply buried potential."))[:200]

        # 10. Record usage
        await record_usage(user_id, "resume_roast", "ai_service", 0, db)

        # 11. Save to history
        save_analysis(
            db=db,
            user_id=user_id,
            tool_type="resume_roast",
            title=f"Resume Roast ({grade_info['grade']})",
            input_summary=headline[:200],
            result_data=json.dumps({
                "overall_score": overall_score,
                "grade": grade_info["grade"],
                "roast_lines": roast_lines,
            }),
            score=overall_score,
        )

        logger.info(f"Resume roasted for user {user_id}: score={overall_score}, grade={grade_info['grade']}")

        return success(
            RoastResponse(
                roast_grade=grade_info["grade"],
                roast_emoji=grade_info["emoji"],
                overall_score=overall_score,
                headline=headline,
                roast_lines=roast_lines,
                category_scores=category_scores,
                real_talk=real_talk,
                ats_score=ats_score,
                share_text=share_text,
            ),
            message="Your resume has been roasted 🔥",
            credits_used=1,
            request=request,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Roast Error for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="The roast oven malfunctioned. Please try again.")
