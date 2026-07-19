"""
X-Ray ATS Semantic Analyzer — Sentence-level resume analysis.
===============================================================
Goes beyond keyword matching. Analyzes each sentence of the resume,
identifies weak sections, and provides inline AI-powered replacement
suggestions that the user can accept with one click.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.services.credit_service import check_and_record_quota, record_usage
from app.utils.file_parser import extract_text_from_file
from app.core.database import get_db
from app.api.history import save_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Response Models ---
class SentenceAnalysis(BaseModel):
    """Analysis of a single sentence from the resume."""
    original: str
    suggestion: Optional[str] = None
    reason: Optional[str] = None
    strength: str  # "strong", "moderate", "weak"
    category: str  # "impact", "clarity", "keywords", "metrics", "relevance"
    score: int  # 1-10


class XRayATSResponse(BaseModel):
    """Full X-Ray ATS analysis response."""
    overall_score: int
    keyword_score: int
    impact_score: int
    clarity_score: int
    total_sentences: int
    weak_count: int
    strong_count: int
    sentences: List[SentenceAnalysis]
    missing_keywords: List[str]
    summary: str


@router.post("/xray", response_model=XRayATSResponse)
async def xray_ats_analysis(
    job_description: str = Form(...),
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    user: dict = Depends(check_and_record_quota),
    db: Session = Depends(get_db),
):
    """
    Performs deep sentence-by-sentence ATS analysis.
    Returns each sentence with a strength rating and AI suggestion.
    """

    final_text = ""
    if resume_file:
        content = await resume_file.read()
        final_text = extract_text_from_file(content, resume_file.filename)
    elif resume_text:
        final_text = resume_text

    if not final_text or len(final_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume content too short or missing.")

    # Split resume into meaningful sentences (filter out blanks and tiny lines)
    raw_sentences = [s.strip() for s in final_text.replace("\n", ". ").split(". ") if len(s.strip()) > 10]
    # Limit to 25 sentences to control AI costs
    sentences_to_analyze = raw_sentences[:25]

    prompt = f"""
    You are an expert ATS (Applicant Tracking System) analyzer and career coach.

    JOB DESCRIPTION:
    {job_description[:3000]}

    RESUME SENTENCES TO ANALYZE:
    {json.dumps(sentences_to_analyze, indent=2)}

    For EACH sentence, analyze it against the job description and return a JSON array.
    Each item must have:
    - "original": the exact original sentence
    - "strength": "strong" | "moderate" | "weak"
    - "score": 1-10 rating
    - "category": main issue category — one of "impact", "clarity", "keywords", "metrics", "relevance"
    - "reason": brief 1-sentence explanation of why it's strong/weak
    - "suggestion": if strength is "moderate" or "weak", provide a rewritten version that is better.
      If "strong", set suggestion to null.

    Also include these top-level fields:
    - "overall_score": 0-100 overall ATS compatibility
    - "keyword_score": 0-100 how well keywords match
    - "impact_score": 0-100 how impactful the language is
    - "clarity_score": 0-100 how clear and professional
    - "missing_keywords": list of important keywords from JD missing in resume
    - "summary": 2-3 sentence overall assessment

    Return JSON:
    {{
        "overall_score": 65,
        "keyword_score": 58,
        "impact_score": 70,
        "clarity_score": 72,
        "missing_keywords": ["Docker", "Kubernetes"],
        "summary": "Your assessment here...",
        "sentences": [
            {{
                "original": "Worked on various projects",
                "strength": "weak",
                "score": 3,
                "category": "impact",
                "reason": "Too vague, lacks specifics and metrics",
                "suggestion": "Led development of 3 full-stack web applications serving 10K+ users"
            }}
        ]
    }}

    IMPORTANT: Return raw JSON only. No markdown. Analyze ALL {len(sentences_to_analyze)} sentences.
    """

    try:
        result = await ai_service.generate_json(prompt)
        await record_usage(user.get("id"), "xray_ats", "ai_service", 0, db)

        # Parse sentences
        sentence_analyses = []
        for s in result.get("sentences", []):
            sentence_analyses.append(SentenceAnalysis(
                original=s.get("original", ""),
                suggestion=s.get("suggestion"),
                reason=s.get("reason", ""),
                strength=s.get("strength", "moderate"),
                category=s.get("category", "clarity"),
                score=s.get("score", 5),
            ))

        overall_score = result.get("overall_score", 50)
        weak_count = sum(1 for s in sentence_analyses if s.strength == "weak")
        strong_count = sum(1 for s in sentence_analyses if s.strength == "strong")

        response = XRayATSResponse(
            overall_score=overall_score,
            keyword_score=result.get("keyword_score", 50),
            impact_score=result.get("impact_score", 50),
            clarity_score=result.get("clarity_score", 50),
            total_sentences=len(sentence_analyses),
            weak_count=weak_count,
            strong_count=strong_count,
            sentences=sentence_analyses,
            missing_keywords=result.get("missing_keywords", []),
            summary=result.get("summary", "Analysis complete."),
        )

        # Save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="xray_ats",
            title=f"X-Ray ATS (Score: {overall_score}%)",
            input_summary=job_description[:200],
            result_data=json.dumps(result),
            score=overall_score,
        )

        logger.info(
            f"X-Ray ATS complete for user {user.get('id')}: "
            f"score={overall_score}, weak={weak_count}, strong={strong_count}"
        )

        return response

    except Exception as e:
        logger.error(f"X-Ray ATS error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="X-Ray ATS analysis failed")
