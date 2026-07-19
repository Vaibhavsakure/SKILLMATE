"""
Interview Simulator API — Full mock interview with multi-turn conversation and scoring.
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
class SimulatorStartRequest(BaseModel):
    job_title: str = Field(..., min_length=2)
    resume_text: str = Field(..., min_length=20)
    difficulty: str = "medium"  # easy, medium, hard


class SimulatorStartResponse(BaseModel):
    session_id: str
    question: str
    question_number: int
    total_questions: int
    category: str  # "technical", "behavioral", "situational"


class AnswerRequest(BaseModel):
    session_id: str
    question: str
    answer: str = Field(..., min_length=5)
    question_number: int
    job_title: str
    resume_text: str


class AnswerResponse(BaseModel):
    feedback: str
    follow_up_question: Optional[str]
    score: int  # 1-10 for this answer
    next_question: Optional[str]
    next_question_number: int
    next_category: Optional[str]
    is_complete: bool


class FinishRequest(BaseModel):
    session_id: str
    job_title: str
    answers: List[dict]  # [{question, answer, score}]


class InterviewReport(BaseModel):
    overall_score: int
    communication_score: int
    technical_score: int
    confidence_score: int
    strengths: List[str]
    improvements: List[str]
    summary: str


# --- Endpoints ---

@router.post("/start-session", response_model=SimulatorStartResponse)
async def start_interview_session(
    data: SimulatorStartRequest,
    user: dict = Depends(get_current_user),
):
    """Starts a mock interview session. Returns the first question."""

    import uuid
    session_id = str(uuid.uuid4())[:8]

    prompt = f"""You are a {data.difficulty}-level interviewer for: {data.job_title}. Be concise. Return JSON only (no markdown).
RESUME: {data.resume_text[:3000]}
Generate a warm-up behavioral opening question.
{{"question":"<question text>","category":"behavioral"}}"""

    try:
        result = await ai_service.generate_json(prompt)
        logger.info(f"Interview session {session_id} started for user {user.get('id')}")

        return SimulatorStartResponse(
            session_id=session_id,
            question=result.get("question", "Tell me about yourself and your experience."),
            question_number=1,
            total_questions=5,
            category=result.get("category", "behavioral"),
        )
    except Exception as e:
        logger.error(f"Interview start error: {e}")
        raise HTTPException(status_code=500, detail="Failed to start interview session")


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(
    data: AnswerRequest,
    user: dict = Depends(get_current_user),
):
    """Submits an answer and gets feedback + next question."""

    is_last = data.question_number >= 5

    prompt = f"""Interview evaluator for: {data.job_title}. Be concise. Return JSON only (no markdown).
Q{data.question_number}: "{data.question}"
ANSWER: "{data.answer}"
RESUME: {data.resume_text[:2000]}
· Score 1-10 (fair but critical) · 2-3 sentence feedback{" · LAST question — omit next_question and next_category" if is_last else " · Next question: rotate technical/behavioral/situational"}
{{"score":<1-10>,"feedback":"<2-3 sentences>",{"" if is_last else '"next_question":"<str>","next_category":"<str>",'}"follow_up_question":null}}"""

    try:
        result = await ai_service.generate_json(prompt)

        return AnswerResponse(
            feedback=result.get("feedback", "Good answer."),
            follow_up_question=result.get("follow_up_question"),
            score=result.get("score", 5),
            next_question=result.get("next_question") if not is_last else None,
            next_question_number=data.question_number + 1,
            next_category=result.get("next_category") if not is_last else None,
            is_complete=is_last,
        )
    except Exception as e:
        logger.error(f"Answer processing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process answer")


@router.post("/finish", response_model=InterviewReport)
async def finish_interview(
    data: FinishRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates a comprehensive interview report with scores."""

    answers_summary = "\n".join([
        f"Q{i+1}: {a.get('question', '')}\nA: {a.get('answer', '')}\nScore: {a.get('score', 'N/A')}"
        for i, a in enumerate(data.answers)
    ])

    prompt = f"""Generate an interview performance report for: {data.job_title}. Be concise. Return JSON only (no markdown).
TRANSCRIPT:
{answers_summary}
{{"overall_score":<0-100>,"communication_score":<0-100>,"technical_score":<0-100>,"confidence_score":<0-100>,"strengths":["str"],"improvements":["str"],"summary":"<paragraph>"}}"""

    try:
        result = await ai_service.generate_json(prompt)

        overall_score = result.get("overall_score", 50)

        # Save to history
        save_analysis(
            db=db,
            user_id=user.get("id"),
            tool_type="interview_simulator",
            title=f"Mock Interview: {data.job_title}",
            input_summary=f"{len(data.answers)} questions answered",
            result_data=json.dumps(result),
            score=overall_score,
        )

        logger.info(f"Interview report generated for user {user.get('id')}: score {overall_score}")

        return InterviewReport(
            overall_score=overall_score,
            communication_score=result.get("communication_score", 50),
            technical_score=result.get("technical_score", 50),
            confidence_score=result.get("confidence_score", 50),
            strengths=result.get("strengths", []),
            improvements=result.get("improvements", []),
            summary=result.get("summary", "Interview completed."),
        )
    except Exception as e:
        logger.error(f"Interview report error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate interview report")
