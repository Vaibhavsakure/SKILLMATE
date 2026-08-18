"""
Voice Interview Simulator — WebSocket API
============================================
Real-time voice-to-voice mock interview using:
- WebSocket for bi-directional communication
- OpenAI Whisper (or browser SpeechRecognition) for Speech-to-Text
- Claude/Groq AI for interview logic
- Browser SpeechSynthesis for Text-to-Speech (client-side)

Protocol:
1. Client connects via ws://host/ws/interview?token=JWT
2. Server sends first question
3. Client sends audio blob OR transcribed text
4. Server evaluates, sends feedback + next question
5. After 5 rounds, server sends final report
"""

import json
import uuid
import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.services.ai_service import ai_service
from app.core.database import SessionLocal
from app.api.history import save_analysis
from app.services.credit_service import check_monthly_quota, record_usage

logger = logging.getLogger(__name__)

router = APIRouter()

# --- In-memory session store (per-connection, short-lived) ---
_active_sessions: Dict[str, Dict[str, Any]] = {}


# --- Pydantic Models for WebSocket Messages ---
class WSMessage(BaseModel):
    type: str
    data: Optional[Dict[str, Any]] = None


class InterviewConfig(BaseModel):
    job_title: str = Field(..., min_length=2)
    resume_text: str = Field(..., min_length=20)
    difficulty: str = "medium"
    total_questions: int = 5


class QuestionResult(BaseModel):
    question: str
    category: str
    question_number: int
    total_questions: int


class AnswerEvaluation(BaseModel):
    score: int
    feedback: str
    follow_up: Optional[str] = None
    next_question: Optional[str] = None
    next_category: Optional[str] = None
    is_complete: bool = False


class InterviewReport(BaseModel):
    overall_score: int
    communication_score: int
    technical_score: int
    confidence_score: int
    problem_solving_score: int
    strengths: List[str]
    improvements: List[str]
    summary: str
    duration_seconds: int
    answers_detail: List[Dict[str, Any]]


# --- Helper: Verify JWT from WebSocket query param ---
async def verify_ws_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify Supabase JWT token for WebSocket connections."""
    from app.core.config import settings
    # Reuse the process-wide client built in deps rather than constructing a
    # fresh one per connection (each create_client opens its own HTTP pool).
    from app.api.deps import _supabase

    if not token:
        return None

    # Try Supabase verification
    if _supabase:
        try:
            # supabase-py's auth client is synchronous — off the event loop.
            user_response = await run_in_threadpool(_supabase.auth.get_user, token)
            if user_response and user_response.user:
                return {
                    "id": user_response.user.id,
                    "email": user_response.user.email,
                    "role": user_response.user.role or "authenticated",
                }
        except Exception as e:
            logger.warning(f"WS token verification failed: {e}")

    # Dev mode fallback
    if settings.env == "development" and settings.allow_dev_mock_auth:
        logger.warning("⚠️ WS Dev Mode: Using mock auth")
        return {
            "id": "dev_user_123",
            "email": "dev@example.com",
            "role": "authenticated",
        }

    return None


# --- AI Prompt Generators ---
async def generate_first_question(config: InterviewConfig) -> Dict[str, Any]:
    """Generate the opening interview question."""
    prompt = f"""
    You are a professional interviewer conducting a {config.difficulty} difficulty interview
    for the role: {config.job_title}

    Candidate resume: {config.resume_text[:3000]}

    Generate the FIRST interview question. It should be a warm-up behavioral question
    that helps the candidate feel comfortable while also being insightful.

    Return JSON:
    {{
        "question": "Your opening question here",
        "category": "behavioral"
    }}

    IMPORTANT: Return raw JSON only.
    """
    return await ai_service.generate_json(prompt)


async def evaluate_answer(
    question: str,
    answer: str,
    question_number: int,
    total_questions: int,
    job_title: str,
    resume_text: str,
    difficulty: str,
    conversation_history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """Evaluate a candidate's answer and generate the next question."""
    is_last = question_number >= total_questions

    # Build conversation context
    history_context = "\n".join([
        f"Q{i+1}: {qa['question']}\nA: {qa['answer']}\nScore: {qa.get('score', 'N/A')}"
        for i, qa in enumerate(conversation_history)
    ])

    prompt = f"""
    You are a professional interviewer for the role: {job_title}
    Difficulty: {difficulty}
    This is question {question_number} of {total_questions}.

    Previous conversation:
    {history_context if history_context else "This is the first answer."}

    Current Question: "{question}"
    Candidate's Answer: "{answer}"

    Resume context: {resume_text[:2000]}

    Instructions:
    1. Rate this answer 1-10 (be fair but rigorous for {difficulty} difficulty).
    2. Give detailed, constructive feedback (3-4 sentences). Mention specific strengths
       and one concrete improvement suggestion.
    {"3. This is the LAST question. Do NOT generate a next question." if is_last else f"3. Generate the next question (question {question_number + 1}). Alternate between technical, behavioral, and situational categories. Make it progressively harder."}

    Return JSON:
    {{
        "score": 7,
        "feedback": "Your detailed feedback here...",
        {"" if is_last else '"next_question": "Your next question here",'}
        {"" if is_last else '"next_category": "technical",'}
        "follow_up": null
    }}

    IMPORTANT: Return raw JSON only.
    """
    return await ai_service.generate_json(prompt)


async def generate_final_report(
    job_title: str,
    answers: List[Dict[str, Any]],
    duration_seconds: int,
) -> Dict[str, Any]:
    """Generate a comprehensive interview performance report."""
    answers_summary = "\n".join([
        f"Q{i+1} ({a.get('category', 'general')}): {a.get('question', '')}\n"
        f"A: {a.get('answer', '')}\n"
        f"Score: {a.get('score', 'N/A')}/10\n"
        f"Feedback: {a.get('feedback', '')}"
        for i, a in enumerate(answers)
    ])

    prompt = f"""
    Generate a comprehensive mock interview performance report.

    Position: {job_title}
    Duration: {duration_seconds // 60} minutes {duration_seconds % 60} seconds
    Questions Answered: {len(answers)}

    Full Interview Transcript:
    {answers_summary}

    Analyze the candidate holistically and return JSON:
    {{
        "overall_score": 72,
        "communication_score": 78,
        "technical_score": 68,
        "confidence_score": 75,
        "problem_solving_score": 70,
        "strengths": ["Strength 1", "Strength 2", "Strength 3"],
        "improvements": ["Improvement 1", "Improvement 2", "Improvement 3"],
        "summary": "A comprehensive 3-4 sentence assessment of the candidate's performance..."
    }}

    IMPORTANT:
    - Scores should be 0-100 and consistent with individual answer scores.
    - Be specific in strengths and improvements. Reference actual answers.
    - Return raw JSON only.
    """
    return await ai_service.generate_json(prompt)


# --- WebSocket Endpoint ---
@router.websocket("/ws/interview")
async def voice_interview_websocket(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    WebSocket endpoint for real-time voice interview simulation.

    Message Protocol (Client → Server):
    - {"type": "start", "data": {"job_title": "...", "resume_text": "...", "difficulty": "medium"}}
    - {"type": "answer", "data": {"transcription": "...", "question_number": 1}}
    - {"type": "finish"}
    - {"type": "ping"}

    Message Protocol (Server → Client):
    - {"type": "session_start", "data": {"session_id": "...", "question": "...", ...}}
    - {"type": "answer_result", "data": {"score": 7, "feedback": "...", ...}}
    - {"type": "interview_complete", "data": {"report": {...}}}
    - {"type": "error", "data": {"message": "..."}}
    - {"type": "pong"}
    """

    # 1. Verify authentication
    user = await verify_ws_token(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # 2. Accept connection
    await websocket.accept()
    user_id = user["id"]
    session_id = str(uuid.uuid4())[:8]
    logger.info(f"🎤 Voice interview WS connected: user={user_id}, session={session_id}")

    # 3. Initialize session state
    session = {
        "id": session_id,
        "user_id": user_id,
        "config": None,
        "answers": [],
        "current_question": None,
        "current_category": None,
        "current_question_number": 0,
        "started_at": time.time(),
        "status": "connected",
    }
    _active_sessions[session_id] = session

    try:
        while True:
            # Receive message
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "Invalid JSON message"}
                })
                continue

            msg_type = msg.get("type", "")
            msg_data = msg.get("data", {})

            # --- Handle: Start Interview ---
            if msg_type == "start":
                try:
                    config = InterviewConfig(**msg_data)

                    # ── Quota check (WebSocket can't use Depends) ──────
                    quota_db = SessionLocal()
                    try:
                        within_quota = await check_monthly_quota(user_id, quota_db)
                        if not within_quota:
                            await websocket.send_json({
                                "type": "error",
                                "data": {"message": "Monthly AI quota exceeded. Upgrade to Pro for 500 calls/month."},
                            })
                            continue
                    finally:
                        quota_db.close()

                    session["config"] = config
                    session["status"] = "in_progress"

                    # Generate first question
                    result = await generate_first_question(config)
                    question = result.get("question", "Tell me about yourself and your experience.")
                    category = result.get("category", "behavioral")

                    session["current_question"] = question
                    session["current_category"] = category
                    session["current_question_number"] = 1

                    await websocket.send_json({
                        "type": "session_start",
                        "data": {
                            "session_id": session_id,
                            "question": question,
                            "category": category,
                            "question_number": 1,
                            "total_questions": config.total_questions,
                        }
                    })
                    logger.info(f"🎬 Interview started: session={session_id}, role={config.job_title}")

                except Exception as e:
                    logger.error(f"Interview start error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": f"Failed to start interview: {str(e)}"}
                    })

            # --- Handle: Submit Answer ---
            elif msg_type == "answer":
                if session["status"] != "in_progress" or not session["config"]:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "No active interview session. Send 'start' first."}
                    })
                    continue

                transcription = msg_data.get("transcription", "").strip()
                if not transcription or len(transcription) < 5:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Answer too short. Please provide a more detailed response."}
                    })
                    continue

                config = session["config"]
                q_num = session["current_question_number"]

                try:
                    # Send "thinking" indicator
                    await websocket.send_json({
                        "type": "evaluating",
                        "data": {"message": "Analyzing your response..."}
                    })

                    # Evaluate the answer
                    evaluation = await evaluate_answer(
                        question=session["current_question"],
                        answer=transcription,
                        question_number=q_num,
                        total_questions=config.total_questions,
                        job_title=config.job_title,
                        resume_text=config.resume_text,
                        difficulty=config.difficulty,
                        conversation_history=session["answers"],
                    )

                    # Store the answer
                    answer_record = {
                        "question": session["current_question"],
                        "category": session["current_category"],
                        "answer": transcription,
                        "score": evaluation.get("score", 5),
                        "feedback": evaluation.get("feedback", ""),
                    }
                    session["answers"].append(answer_record)

                    is_complete = q_num >= config.total_questions

                    if is_complete:
                        # Generate final report
                        await websocket.send_json({
                            "type": "generating_report",
                            "data": {"message": "Generating your performance report..."}
                        })

                        duration = int(time.time() - session["started_at"])
                        report = await generate_final_report(
                            job_title=config.job_title,
                            answers=session["answers"],
                            duration_seconds=duration,
                        )

                        # Build full report
                        full_report = {
                            "overall_score": report.get("overall_score", 50),
                            "communication_score": report.get("communication_score", 50),
                            "technical_score": report.get("technical_score", 50),
                            "confidence_score": report.get("confidence_score", 50),
                            "problem_solving_score": report.get("problem_solving_score", 50),
                            "strengths": report.get("strengths", []),
                            "improvements": report.get("improvements", []),
                            "summary": report.get("summary", "Interview completed."),
                            "duration_seconds": duration,
                            "answers_detail": session["answers"],
                            "last_answer_feedback": evaluation.get("feedback", ""),
                            "last_answer_score": evaluation.get("score", 5),
                        }

                        # Save to history
                        db = SessionLocal()
                        try:
                            save_analysis(
                                db=db,
                                user_id=user_id,
                                tool_type="voice_interview",
                                title=f"Voice Interview: {config.job_title}",
                                input_summary=f"{len(session['answers'])} questions, {duration}s",
                                result_data=json.dumps(full_report),
                                score=full_report["overall_score"],
                            )
                        except Exception as e:
                            logger.error(f"Failed to save interview history: {e}")
                        finally:
                            db.close()

                        # Record usage for quota tracking
                        usage_db = SessionLocal()
                        try:
                            await record_usage(user_id, "voice_interview", "ai_service", 0, usage_db)
                        except Exception as e:
                            logger.error(f"Failed to record voice interview usage: {e}")
                        finally:
                            usage_db.close()

                        await websocket.send_json({
                            "type": "interview_complete",
                            "data": {"report": full_report}
                        })

                        session["status"] = "completed"
                        logger.info(
                            f"✅ Interview complete: session={session_id}, "
                            f"score={full_report['overall_score']}"
                        )
                    else:
                        # Send feedback + next question
                        next_q = evaluation.get("next_question", "Can you elaborate on that?")
                        next_cat = evaluation.get("next_category", "technical")

                        session["current_question"] = next_q
                        session["current_category"] = next_cat
                        session["current_question_number"] = q_num + 1

                        await websocket.send_json({
                            "type": "answer_result",
                            "data": {
                                "score": evaluation.get("score", 5),
                                "feedback": evaluation.get("feedback", "Good answer."),
                                "follow_up": evaluation.get("follow_up"),
                                "next_question": next_q,
                                "next_category": next_cat,
                                "question_number": q_num + 1,
                                "total_questions": config.total_questions,
                                "is_complete": False,
                            }
                        })

                except Exception as e:
                    logger.error(f"Answer evaluation error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Failed to evaluate answer. Please try again."}
                    })

            # --- Handle: Ping (Keep-alive) ---
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            # --- Handle: Early Finish ---
            elif msg_type == "finish":
                if session["answers"]:
                    duration = int(time.time() - session["started_at"])
                    config = session["config"]

                    await websocket.send_json({
                        "type": "generating_report",
                        "data": {"message": "Generating early exit report..."}
                    })

                    report = await generate_final_report(
                        job_title=config.job_title if config else "Unknown",
                        answers=session["answers"],
                        duration_seconds=duration,
                    )

                    full_report = {
                        "overall_score": report.get("overall_score", 50),
                        "communication_score": report.get("communication_score", 50),
                        "technical_score": report.get("technical_score", 50),
                        "confidence_score": report.get("confidence_score", 50),
                        "problem_solving_score": report.get("problem_solving_score", 50),
                        "strengths": report.get("strengths", []),
                        "improvements": report.get("improvements", []),
                        "summary": report.get("summary", "Interview ended early."),
                        "duration_seconds": duration,
                        "answers_detail": session["answers"],
                    }

                    await websocket.send_json({
                        "type": "interview_complete",
                        "data": {"report": full_report}
                    })

                session["status"] = "completed"
                break

            else:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": f"Unknown message type: {msg_type}"}
                })

    except WebSocketDisconnect:
        logger.info(f"🔌 WS disconnected: session={session_id}")
    except Exception as e:
        logger.error(f"WS error: session={session_id}, error={e}")
        try:
            await websocket.send_json({
                "type": "error",
                "data": {"message": "Internal server error"}
            })
        except Exception:
            pass
    finally:
        # Cleanup session
        _active_sessions.pop(session_id, None)
        logger.info(f"🧹 Session cleaned up: {session_id}")
