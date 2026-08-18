"""
Skillmate Backend — Credit Service (Full ORM)
===============================================
Used when you need a DB session injected (e.g., from route Depends).

Includes:
  - Credit wallet management (get / consume / add)
  - Monthly AI call quota enforcement (free: 50, pro: 500)
  - Usage recording for analytics
"""

import logging
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.usage import UsageLog
from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
#  Quota configuration
# ---------------------------------------------------------------------------

MONTHLY_QUOTA_FREE = 50
MONTHLY_QUOTA_PRO = 500


# ===========================================================================
#  Existing credit wallet helpers (unchanged)
# ===========================================================================

def get_user_credits(db: Session, user_id: str) -> UserCredits:
    """
    Retrieves the user's credit record.
    If it doesn't exist (new user), creates one with default credits.
    """
    try:
        wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()

        if not wallet:
            logger.info(f"🆕 Creating new credit wallet for User {user_id}")
            wallet = UserCredits(user_id=user_id, credits=5)
            db.add(wallet)
            db.commit()
            db.refresh(wallet)

        return wallet

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"❌ Database Error in get_user_credits: {e}")
        raise e


def consume_credits(db: Session, user_id: str, action: str, cost: int) -> tuple:
    """
    Safely deducts credits for an action.
    Returns: (Success: bool, Remaining_Credits: int)
    """
    try:
        wallet = get_user_credits(db, user_id)

        if wallet.credits < cost:
            logger.warning(f"⚠️ User {user_id} attempted '{action}' but has insufficient funds.")
            return False, wallet.credits

        wallet.credits -= cost

        # Use 'change' column (matches CreditTransaction model)
        transaction = CreditTransaction(
            user_id=user_id,
            change=-cost,
            reason=action,
        )

        db.add(transaction)
        db.commit()
        db.refresh(wallet)

        logger.info(f"💰 Consumed {cost} credits for {user_id}. Remaining: {wallet.credits}")
        return True, wallet.credits

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"❌ Transaction Failed: {e}")
        return False, 0


def spend_credits(db: Session, user_id: str, action: str, cost: int) -> int:
    """
    Deduct `cost` credits or raise HTTP 402.

    Wrapper around consume_credits for route handlers: a route that advertises
    `credits_used=N` in its response must call this, otherwise the balance
    never moves and the credit system is decorative.

    Returns the remaining balance.
    """
    if cost <= 0:
        return get_user_credits(db, user_id).credits

    ok, remaining = consume_credits(db, user_id, action, cost)
    if not ok:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {cost}, Available: {remaining}",
        )
    return remaining


def add_credits(db: Session, user_id: str, amount: int, reason: str) -> int:
    """
    Adds credits (for purchases or bonuses).
    """
    try:
        wallet = get_user_credits(db, user_id)

        wallet.credits += amount

        transaction = CreditTransaction(
            user_id=user_id,
            change=amount,
            reason=reason,
        )

        db.add(transaction)
        db.commit()
        db.refresh(wallet)

        return wallet.credits

    except SQLAlchemyError as e:
        db.rollback()
        raise e


# ===========================================================================
#  Monthly quota system
# ===========================================================================

def _month_start() -> datetime:
    """Return the first instant of the current calendar month (UTC)."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _month_end() -> datetime:
    """Return the first instant of the NEXT month (UTC) — used as resets_at."""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        return now.replace(year=now.year + 1, month=1, day=1,
                           hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=now.month + 1, day=1,
                       hour=0, minute=0, second=0, microsecond=0)


def _is_pro_user(db: Session, user_id: str) -> bool:
    """Check if user has a pro subscription."""
    user = db.query(User).filter(User.id == user_id).first()
    return bool(user and user.is_pro)


def get_monthly_usage_count(db: Session, user_id: str) -> int:
    """Count how many AI calls the user made this calendar month."""
    start = _month_start()
    count = (
        db.query(sa_func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.created_at >= start,
        )
        .scalar()
    )
    return count or 0


async def check_monthly_quota(user_id: str, db: Session) -> bool:
    """
    Return True if the user is within their monthly quota.

    Free users: 50 AI calls/month
    Pro users:  500 AI calls/month
    """
    is_pro = _is_pro_user(db, user_id)
    limit = MONTHLY_QUOTA_PRO if is_pro else MONTHLY_QUOTA_FREE
    used = get_monthly_usage_count(db, user_id)
    return used < limit


async def record_usage(
    user_id: str,
    tool_name: str,
    provider_used: str,
    tokens_used: int,
    db: Session,
) -> None:
    """
    Write a row to usage_logs for analytics and quota tracking.

    The `details` column stores provider + token metadata as a string
    for lightweight analytics queries.
    """
    try:
        log = UsageLog(
            user_id=user_id,
            action=tool_name,
            credits_used=0,  # credits are tracked separately
            details=f"provider={provider_used};tokens={tokens_used}",
        )
        db.add(log)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Failed to record usage for {user_id}: {exc}")


def get_quota_info(db: Session, user_id: str) -> dict:
    """
    Build the quota status dict for the /credits/quota endpoint.

    Returns:
        {"used": 12, "limit": 50, "resets_at": "2026-08-01T00:00:00+00:00"}
    """
    is_pro = _is_pro_user(db, user_id)
    limit = MONTHLY_QUOTA_PRO if is_pro else MONTHLY_QUOTA_FREE
    used = get_monthly_usage_count(db, user_id)
    resets_at = _month_end()

    return {
        "used": used,
        "limit": limit,
        "resets_at": resets_at.isoformat(),
    }


# ===========================================================================
#  FastAPI dependency — plug into any route
# ===========================================================================

async def check_and_record_quota(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    FastAPI dependency that:
      1. Checks the user's monthly quota — raises 429 if exceeded.
      2. Returns the user dict so downstream handlers still have it.

    Usage in routes:
        from app.services.credit_service import check_and_record_quota

        @router.post("/rewrite")
        async def rewrite(user: dict = Depends(check_and_record_quota), ...):
            ...
            # After the AI call succeeds, record the usage:
            await record_usage(user["id"], "resume_rewrite", "claude", tokens, db)
    """
    user_id = user.get("id", "")
    within_quota = await check_monthly_quota(user_id, db)

    if not within_quota:
        is_pro = _is_pro_user(db, user_id)
        limit = MONTHLY_QUOTA_PRO if is_pro else MONTHLY_QUOTA_FREE
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Monthly AI quota exceeded",
                "limit": limit,
                "resets_at": _month_end().isoformat(),
                "upgrade": not is_pro,
            },
        )

    return user