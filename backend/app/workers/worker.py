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
# Redis settings — read from REDIS_URL so the worker and the API enqueue
# against the same instance (docker-compose sets redis://redis:6379/0).
# ---------------------------------------------------------------------------

from app.core.config import settings

REDIS = RedisSettings.from_dsn(settings.redis_url)


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

    # ── Trigger 4: career roadmap ready email ────────────────────
    try:
        from app.core.database import SessionLocal
        from app.models.user import User
        from app.workers.email_tasks import enqueue_email

        db = SessionLocal()
        try:
            user_row = db.query(User).filter(User.id == user_id).first()
            user_email = user_row.email if user_row else ""
            user_name  = user_email.split("@")[0] if user_email else ""

            if user_email:
                await enqueue_email(
                    "career_roadmap_ready",
                    to_email=user_email,
                    name=user_name,
                )
                logger.info("[job] roadmap ready email enqueued | user=%s", user_id)
        finally:
            db.close()
    except Exception as exc:
        logger.warning("[job] roadmap ready email failed (non-fatal): %s", exc)

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
        "welcome":               lambda: email_service.send_welcome(to_email, kwargs.get("name", "")),
        "credits_purchased":     lambda: email_service.send_credits_purchased(
            to_email, kwargs.get("name", ""), kwargs.get("credits", 0), kwargs.get("amount_usd", "$0"),
        ),
        "password_reset":        lambda: email_service.send_password_reset(to_email, kwargs.get("reset_link", "")),
        "recruiter_match":        lambda: email_service.send_recruiter_match(
            to_email, kwargs.get("candidate_name", ""), kwargs.get("job_title", ""), kwargs.get("score", 0),
        ),
        # ── New triggers ─────────────────────────────────────────────────────────
        "credit_low":            lambda: email_service.send_credit_low(
            to_email, kwargs.get("name", ""), kwargs.get("remaining", 0),
        ),
        "career_roadmap_ready":  lambda: email_service.send_career_roadmap_ready(
            to_email, kwargs.get("name", ""),
        ),
        "weekly_digest":         lambda: email_service.send_weekly_digest(
            to_email, kwargs.get("name", ""), kwargs.get("stats", {}),
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
# Trigger 5 — Weekly digest cron (every Monday 9:00 AM UTC)
# ---------------------------------------------------------------------------

async def weekly_digest_bg(ctx: dict) -> dict[str, Any]:
    """
    Scheduled cron task: send weekly usage digest to all active users.

    "Active" = at least 1 AI tool use in the past 7 days.
    Runs every Monday at 09:00 UTC (configured in WorkerSettings.cron_jobs).

    Returns a summary dict: {sent, skipped, failed, total}.
    """
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func as sa_func

    from app.core.database import SessionLocal
    from app.models.user import User
    from app.models.credit_models import UserCredits
    from app.models.usage import UsageLog
    from app.models.credit_models import CreditTransaction
    from app.workers.email_tasks import enqueue_email

    logger.info("[cron] weekly_digest_bg: starting")

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    db = SessionLocal()
    stats_out = {"sent": 0, "skipped": 0, "failed": 0, "total": 0}

    try:
        # Find users active in the past 7 days
        active_user_ids = (
            db.query(UsageLog.user_id)
            .filter(UsageLog.created_at >= week_ago)
            .distinct()
            .all()
        )
        active_user_ids = [row[0] for row in active_user_ids]
        stats_out["total"] = len(active_user_ids)

        logger.info("[cron] weekly_digest: %d active users found", len(active_user_ids))

        for user_id in active_user_ids:
            try:
                user_row = db.query(User).filter(User.id == user_id).first()
                if not user_row or not user_row.email:
                    stats_out["skipped"] += 1
                    continue

                # ── Build 7-day stats ──────────────────────────────────
                # Tools used this week
                usage_rows = (
                    db.query(UsageLog.action)
                    .filter(
                        UsageLog.user_id == user_id,
                        UsageLog.created_at >= week_ago,
                    )
                    .all()
                )
                tools_used = len(usage_rows)
                tool_counts: dict[str, int] = {}
                for (action,) in usage_rows:
                    tool_counts[action] = tool_counts.get(action, 0) + 1
                top_tool = max(tool_counts, key=tool_counts.get) if tool_counts else "—"

                # Credits spent this week (sum of negative transactions)
                credits_spent_row = (
                    db.query(sa_func.sum(CreditTransaction.change))
                    .filter(
                        CreditTransaction.user_id == user_id,
                        CreditTransaction.created_at >= week_ago,
                        CreditTransaction.change < 0,
                    )
                    .scalar()
                )
                credits_spent = abs(int(credits_spent_row or 0))

                # Current balance
                wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
                credits_balance = wallet.credits if wallet else 0

                user_stats = {
                    "tools_used":      tools_used,
                    "credits_spent":   credits_spent,
                    "credits_balance": credits_balance,
                    "top_tool":        top_tool.replace("_", " ").title() if top_tool else "—",
                    "ats_scores":      [],  # extend later with ATS history if needed
                }

                user_name = user_row.email.split("@")[0]

                await enqueue_email(
                    "weekly_digest",
                    to_email=user_row.email,
                    name=user_name,
                    stats=user_stats,
                )
                stats_out["sent"] += 1

            except Exception as exc:
                logger.warning(
                    "[cron] weekly_digest: failed for user=%s | error=%s",
                    user_id, exc,
                )
                stats_out["failed"] += 1

    finally:
        db.close()

    logger.info(
        "[cron] weekly_digest_bg done | sent=%d skipped=%d failed=%d total=%d",
        stats_out["sent"], stats_out["skipped"], stats_out["failed"], stats_out["total"],
    )
    return stats_out


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
        weekly_digest_bg,
    ]
    cron_jobs = [
        # Trigger 5 — weekly digest every Monday at 09:00 UTC
        cron(
            weekly_digest_bg,
            weekday=0,       # 0 = Monday
            hour=9,
            minute=0,
            run_at_startup=False,
        ),
    ]
    redis_settings = REDIS
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10                  # concurrency limit
    job_timeout = 300              # 5 min hard timeout per job
    keep_result = 3600             # keep results for 1 hour
    health_check_interval = 30     # seconds between health pings
