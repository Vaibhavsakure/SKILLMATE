"""
Skillmate AI — Email Task Helpers
===================================
Thin wrappers around ARQ's enqueue_job so every trigger site
has a one-liner: `await enqueue_email("welcome", to=..., name=...)`.

All functions:
  • are fully async (non-blocking — job goes to Redis immediately)
  • wrap with try/except so a Redis outage NEVER breaks the caller
  • fall back to direct async send if ARQ is unavailable (graceful degradation)

Usage:
    from app.workers.email_tasks import enqueue_email

    await enqueue_email("welcome", to_email="alice@example.com", name="Alice")
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("skillmate.email_tasks")

# ── Shared ARQ pool (reuses the same singleton from tasks.py) ──────────────
_arq_pool = None
_ARQ_SETTINGS_HOST = "redis"
_ARQ_SETTINGS_PORT = 6379


async def _get_pool():
    """Lazy singleton ARQ Redis pool."""
    global _arq_pool
    if _arq_pool is None:
        from arq.connections import create_pool, RedisSettings
        _arq_pool = await create_pool(
            RedisSettings(host=_ARQ_SETTINGS_HOST, port=_ARQ_SETTINGS_PORT)
        )
    return _arq_pool


async def enqueue_email(email_type: str, to_email: str, **kwargs: Any) -> bool:
    """
    Enqueue a fire-and-forget email job via ARQ.

    Args:
        email_type: One of "welcome", "credits_purchased", "credit_low",
                    "password_reset", "recruiter_match", "career_roadmap_ready",
                    "weekly_digest".
        to_email:   Recipient address.
        **kwargs:   Extra args forwarded to send_email_bg (name, credits, etc.)

    Returns:
        True if job was enqueued, False if enqueueing failed (email not sent).
    """
    if not to_email:
        logger.debug("enqueue_email skipped — no to_email (type=%s)", email_type)
        return False

    try:
        pool = await _get_pool()
        await pool.enqueue_job(
            "send_email_bg",
            email_type=email_type,
            to_email=to_email,
            **kwargs,
        )
        logger.info(
            "📧 Email enqueued | type=%s | to=%s",
            email_type, to_email,
        )
        return True
    except Exception as exc:
        logger.warning(
            "📧 Email enqueue failed (non-fatal) | type=%s | to=%s | error=%s",
            email_type, to_email, exc,
        )
        # Graceful degradation: attempt direct send so the email is not lost
        try:
            from app.services.email_service import email_service

            dispatch = {
                "welcome":            lambda: email_service.send_welcome(
                    to_email, kwargs.get("name", "")
                ),
                "credits_purchased":  lambda: email_service.send_credits_purchased(
                    to_email,
                    kwargs.get("name", ""),
                    kwargs.get("credits", 0),
                    kwargs.get("amount_usd", "$0"),
                ),
                "password_reset":     lambda: email_service.send_password_reset(
                    to_email, kwargs.get("reset_link", "")
                ),
                "recruiter_match":    lambda: email_service.send_recruiter_match(
                    to_email,
                    kwargs.get("candidate_name", ""),
                    kwargs.get("job_title", ""),
                    kwargs.get("score", 0),
                ),
                "credit_low":         lambda: email_service.send_credit_low(
                    to_email,
                    kwargs.get("name", ""),
                    kwargs.get("remaining", 0),
                ),
                "career_roadmap_ready": lambda: email_service.send_career_roadmap_ready(
                    to_email,
                    kwargs.get("name", ""),
                ),
                "weekly_digest":      lambda: email_service.send_weekly_digest(
                    to_email,
                    kwargs.get("name", ""),
                    kwargs.get("stats", {}),
                ),
            }
            handler = dispatch.get(email_type)
            if handler:
                await handler()
                logger.info(
                    "📧 Direct email sent (ARQ fallback) | type=%s | to=%s",
                    email_type, to_email,
                )
                return True
        except Exception as direct_exc:
            logger.warning(
                "📧 Direct email fallback also failed | type=%s | to=%s | error=%s",
                email_type, to_email, direct_exc,
            )
        return False
