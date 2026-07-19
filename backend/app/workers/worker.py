"""
Skillmate AI — ARQ Background Worker
======================================
Async-native job queue using ARQ + Redis.

Start the worker:
    arq app.workers.worker.WorkerSettings

Or via Docker:
    docker compose up worker

Available jobs:
    - generate_career_roadmap_bg  — long-running AI roadmap generation
    - bulk_cv_screening_bg        — screen multiple CVs against a job
    - send_email_bg               — fire-and-forget email dispatch
"""

from __future__ import annotations

import json
import logging
from typing import Any

from arq import cron
from arq.connections import RedisSettings

logger = logging.getLogger("skillmate.worker")


# ---------------------------------------------------------------------------
# Redis settings (matches docker-compose: redis://redis:6379)
# ---------------------------------------------------------------------------

REDIS = RedisSettings(host="redis", port=6379, database=0)


# ---------------------------------------------------------------------------
# Job functions
# ---------------------------------------------------------------------------
# ARQ convention: first arg is always `ctx` (dict with redis connection, etc.)

async def generate_career_roadmap_bg(
    ctx: dict,
    user_id: str,
    resume_text: str,
    target_role: str,
) -> dict[str, Any]:
    """
    Generate a full career roadmap in the background.

    Returns the roadmap JSON dict, which ARQ stores as the job result.
    Callers retrieve it via GET /api/v1/tasks/{job_id}/status.
    """
    logger.info(f"[job] generate_career_roadmap_bg: user={user_id} role={target_role}")

    from app.services.ai_service import ai_service

    skills_context = resume_text[:3000] if resume_text else "Starting from scratch."
    prompt = f"""Create a learning roadmap to become: {target_role}. Be concise. Return JSON only.
CURRENT SKILLS: {skills_context}
{{
  "role_summary":"<1-sentence motivational summary>",
  "milestones":[{{"step_number":<int>,"title":"<short action title>","description":"<2 sentences>","resources":["<2 sources>"],"estimated_weeks":"<e.g. 2-4 weeks>"}}]
}}
· 4-6 milestones total"""

    result = await ai_service.generate_json(prompt)
    logger.info(f"[job] roadmap completed: user={user_id} milestones={len(result.get('milestones', []))}")

    # Persist to analysis history (optional — uses its own DB session)
    try:
        from app.core.database import SessionLocal
        from app.api.history import save_analysis

        db = SessionLocal()
        try:
            save_analysis(
                db=db,
                user_id=user_id,
                tool_type="career_roadmap",
                title=f"Roadmap: {target_role}",
                input_summary=resume_text[:200] if resume_text else "From scratch",
                result_data=json.dumps(result),
            )
        finally:
            db.close()
    except Exception as exc:
        logger.warning(f"[job] history save failed (non-fatal): {exc}")

    return result


async def bulk_cv_screening_bg(
    ctx: dict,
    job_id: str,
    candidate_ids: list[int],
) -> dict[str, Any]:
    """
    Screen a batch of candidates against a recruiter's job description.

    Loads the job and each candidate from the DB, scores them via AI, and
    persists updated scores. Returns a summary dict.
    """
    logger.info(f"[job] bulk_cv_screening_bg: job={job_id} candidates={len(candidate_ids)}")

    from app.core.database import SessionLocal
    from app.services.ai_service import ai_service
    from app.models.recruiter_models import RecruiterJob, Candidate

    db = SessionLocal()
    results: list[dict] = []

    try:
        job = db.query(RecruiterJob).filter(RecruiterJob.id == job_id).first()
        if not job:
            return {"error": f"Job {job_id} not found", "screened": 0}

        jd_text = job.jd_text or ""

        for cid in candidate_ids:
            candidate = db.query(Candidate).filter(Candidate.id == cid).first()
            if not candidate:
                results.append({"candidate_id": cid, "error": "not found"})
                continue

            cv_text = candidate.cv_text or ""

            prompt = f"""Score this candidate CV vs the job description. Return JSON only.
JOB: {jd_text[:2000]}
CV: {cv_text[:3000]}
{{"overall_score":<int 0-100>,"skills_match":<int 0-100>,"experience_fit":<int 0-100>,"summary":"<1 sentence>"}}"""

            try:
                score_data = await ai_service.generate_json(prompt)
                candidate.overall_score = score_data.get("overall_score", 0)
                candidate.skills_match = score_data.get("skills_match", 0)
                candidate.experience_fit = score_data.get("experience_fit", 0)
                db.commit()

                results.append({
                    "candidate_id": cid,
                    "name": candidate.applicant_name,
                    "score": candidate.overall_score,
                })
                logger.info(f"[job] screened candidate {cid}: score={candidate.overall_score}")

            except Exception as exc:
                logger.warning(f"[job] screening failed for candidate {cid}: {exc}")
                results.append({"candidate_id": cid, "error": str(exc)})

    finally:
        db.close()

    summary = {
        "job_id": job_id,
        "screened": len([r for r in results if "score" in r]),
        "failed": len([r for r in results if "error" in r]),
        "candidates": results,
    }
    logger.info(f"[job] bulk screening done: {summary['screened']} screened, {summary['failed']} failed")
    return summary


async def send_email_bg(
    ctx: dict,
    email_type: str,
    to_email: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Send a transactional email in the background.

    Supported email_type values:
        - "welcome"           → kwargs: name
        - "credits_purchased" → kwargs: name, credits, amount
        - "password_reset"    → kwargs: reset_link
        - "recruiter_match"   → kwargs: candidate_name, job_title, score
    """
    logger.info(f"[job] send_email_bg: type={email_type} to={to_email}")

    from app.services.email_service import email_service

    dispatch = {
        "welcome":           lambda: email_service.send_welcome_email(to_email, kwargs.get("name", "")),
        "credits_purchased": lambda: email_service.send_credits_purchased(
            to_email, kwargs.get("name", ""), kwargs.get("credits", 0), kwargs.get("amount", "$0"),
        ),
        "password_reset":    lambda: email_service.send_password_reset(to_email, kwargs.get("reset_link", "")),
        "recruiter_match":   lambda: email_service.send_recruiter_match_alert(
            to_email, kwargs.get("candidate_name", ""), kwargs.get("job_title", ""), kwargs.get("score", 0),
        ),
    }

    handler = dispatch.get(email_type)
    if not handler:
        logger.error(f"[job] unknown email_type: {email_type}")
        return {"sent": False, "error": f"unknown email_type: {email_type}"}

    sent = await handler()
    return {"sent": sent, "email_type": email_type, "to": to_email}


# ---------------------------------------------------------------------------
# Startup / shutdown hooks
# ---------------------------------------------------------------------------

async def startup(ctx: dict) -> None:
    """Runs once when the worker starts."""
    logger.info("🚀 ARQ worker started")


async def shutdown(ctx: dict) -> None:
    """Runs once when the worker stops."""
    logger.info("🛑 ARQ worker shutting down")


# ---------------------------------------------------------------------------
# WorkerSettings — ARQ picks this up automatically
# ---------------------------------------------------------------------------

class WorkerSettings:
    """
    Entry point for the ARQ worker process.

    Run:  arq app.workers.worker.WorkerSettings
    """
    functions = [
        generate_career_roadmap_bg,
        bulk_cv_screening_bg,
        send_email_bg,
    ]
    redis_settings = REDIS
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10                  # concurrency limit
    job_timeout = 300              # 5 min hard timeout per job
    keep_result = 3600             # keep results for 1 hour
    health_check_interval = 30     # seconds between health pings
