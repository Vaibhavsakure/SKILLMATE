"""
Admin Panel API — Full admin dashboard backend.
=================================================
All endpoints require role === "admin" (enforced by require_admin dependency).

Endpoints:
    GET  /admin/users                      — paginated user list
    POST /admin/users/{user_id}/credits    — override credit balance
    GET  /admin/analytics                  — dashboard analytics
    POST /admin/users/{user_id}/ban        — ban/unban a user
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sql_func, case, and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.analysis_history import AnalysisHistory
from app.models.usage import UsageLog

logger = logging.getLogger(__name__)

router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════
#  Schemas
# ═══════════════════════════════════════════════════════════════════════════


class AdminUserItem(BaseModel):
    id: str
    email: str
    role: str
    credits_remaining: int
    is_pro: bool
    is_banned: bool
    created_at: Optional[str] = None
    last_active: Optional[str] = None


class PaginatedUsersResponse(BaseModel):
    users: List[AdminUserItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreditOverrideRequest(BaseModel):
    new_balance: int = Field(..., ge=0, description="New credit balance (≥ 0)")
    reason: str = Field(..., min_length=3, max_length=200, description="Admin reason for override")


class CreditOverrideResponse(BaseModel):
    user_id: str
    previous_balance: int
    new_balance: int
    reason: str


class BanRequest(BaseModel):
    banned: bool = Field(True, description="True to ban, False to unban")
    reason: Optional[str] = Field(None, max_length=300, description="Reason for ban")


class BanResponse(BaseModel):
    user_id: str
    email: str
    is_banned: bool
    reason: Optional[str]


class ToolUsage(BaseModel):
    tool_type: str
    count: int


class DailyDataPoint(BaseModel):
    date: str
    count: int


class DailyToolDataPoint(BaseModel):
    date: str
    tool_type: str
    count: int


class AdminAnalyticsResponse(BaseModel):
    # Summary cards
    total_users: int
    active_today: int
    total_revenue_usd: float
    most_used_feature: str
    # Charts
    daily_signups: List[DailyDataPoint]
    daily_tool_usage: List[DailyToolDataPoint]
    tool_distribution: List[ToolUsage]
    top_tools: List[str]
    # Extra
    total_analyses: int
    total_credits_consumed: int
    avg_score: int


# ═══════════════════════════════════════════════════════════════════════════
#  1. GET /admin/users — Paginated user list
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by email"),
    role: Optional[str] = Query(None, description="Filter by role"),
    user: dict = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Paginated list of all users with credit balance and activity info."""
    try:
        query = db.query(User)

        # Search filter
        if search:
            query = query.filter(User.email.ilike(f"%{search}%"))

        # Role filter
        if role:
            query = query.filter(User.role == role)

        total = query.count()
        total_pages = max(1, (total + page_size - 1) // page_size)

        users_rows = (
            query
            .order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        # Batch-fetch credit balances for these users
        user_ids = [u.id for u in users_rows]
        credit_map = {}
        if user_ids:
            credits_rows = (
                db.query(UserCredits.user_id, UserCredits.credits)
                .filter(UserCredits.user_id.in_(user_ids))
                .all()
            )
            credit_map = {row.user_id: row.credits for row in credits_rows}

        users_out = [
            AdminUserItem(
                id=u.id,
                email=u.email or "",
                role=u.role or "student",
                credits_remaining=credit_map.get(u.id, 0),
                is_pro=bool(u.is_pro),
                is_banned=bool(getattr(u, "is_banned", False)),
                created_at=u.created_at.isoformat() if u.created_at else None,
                last_active=u.last_active.isoformat() if getattr(u, "last_active", None) else None,
            )
            for u in users_rows
        ]

        return PaginatedUsersResponse(
            users=users_out,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    except Exception as e:
        logger.error("Admin list_users error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch users")


# ═══════════════════════════════════════════════════════════════════════════
#  2. POST /admin/users/{user_id}/credits — Override credit balance
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/users/{user_id}/credits", response_model=CreditOverrideResponse)
async def override_credits(
    user_id: str,
    data: CreditOverrideRequest,
    admin: dict = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Set a user's credit balance to an exact value (admin override)."""

    # Verify target user exists
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    # Get or create wallet
    wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
    if not wallet:
        wallet = UserCredits(user_id=user_id, credits=0)
        db.add(wallet)
        db.flush()

    previous_balance = wallet.credits
    delta = data.new_balance - previous_balance

    # Update balance
    wallet.credits = data.new_balance

    # Log transaction
    tx = CreditTransaction(
        user_id=user_id,
        change=delta,
        reason=f"admin_override: {data.reason} (by {admin.get('email', 'admin')})",
    )
    db.add(tx)
    db.commit()

    logger.info(
        "Admin credit override | target=%s | prev=%d | new=%d | delta=%d | reason=%s | admin=%s",
        user_id, previous_balance, data.new_balance, delta, data.reason, admin.get("id"),
    )

    return CreditOverrideResponse(
        user_id=user_id,
        previous_balance=previous_balance,
        new_balance=data.new_balance,
        reason=data.reason,
    )


# ═══════════════════════════════════════════════════════════════════════════
#  3. GET /admin/analytics — Dashboard analytics
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/analytics", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    days: int = Query(30, ge=1, le=90, description="Look-back window in days"),
    admin: dict = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Returns aggregated analytics for the admin dashboard."""

    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        window_start = now - timedelta(days=days)

        # ── Summary cards ─────────────────────────────────────────────────
        total_users = db.query(sql_func.count(User.id)).scalar() or 0

        # Active today = users with usage_logs created today
        active_today = (
            db.query(sql_func.count(sql_func.distinct(UsageLog.user_id)))
            .filter(UsageLog.created_at >= today_start)
            .scalar()
        ) or 0

        # Revenue = sum of positive credit transactions (purchases)
        revenue_credits = (
            db.query(sql_func.sum(CreditTransaction.change))
            .filter(CreditTransaction.change > 0)
            .filter(CreditTransaction.reason.like("purchase_%"))
            .scalar()
        ) or 0
        # Approximate: credits → USD (50 credits = $5 = $0.10/credit)
        total_revenue_usd = round(float(revenue_credits) * 0.10, 2)

        # Total credits consumed
        total_credits_consumed = abs(
            (
                db.query(sql_func.sum(CreditTransaction.change))
                .filter(CreditTransaction.change < 0)
                .scalar()
            ) or 0
        )

        # Total analyses
        total_analyses = db.query(sql_func.count(AnalysisHistory.id)).scalar() or 0

        # Average score
        avg = db.query(sql_func.avg(AnalysisHistory.score)).filter(
            AnalysisHistory.score.isnot(None)
        ).scalar()
        avg_score = int(avg) if avg else 0

        # Tool usage distribution
        tool_counts = (
            db.query(
                AnalysisHistory.tool_type,
                sql_func.count(AnalysisHistory.id).label("count"),
            )
            .group_by(AnalysisHistory.tool_type)
            .order_by(sql_func.count(AnalysisHistory.id).desc())
            .all()
        )
        tool_distribution = [ToolUsage(tool_type=t[0], count=t[1]) for t in tool_counts]
        top_tools = [t[0] for t in tool_counts[:5]]
        most_used_feature = top_tools[0] if top_tools else "—"

        # ── Daily signups (last N days) ───────────────────────────────────
        daily_signups_q = (
            db.query(
                sql_func.date(User.created_at).label("date"),
                sql_func.count(User.id).label("count"),
            )
            .filter(User.created_at >= window_start)
            .group_by(sql_func.date(User.created_at))
            .order_by(sql_func.date(User.created_at))
            .all()
        )
        daily_signups = [
            DailyDataPoint(date=str(row.date), count=row.count)
            for row in daily_signups_q
        ]

        # ── Daily tool usage by type (last N days) ────────────────────────
        daily_tool_q = (
            db.query(
                sql_func.date(AnalysisHistory.created_at).label("date"),
                AnalysisHistory.tool_type,
                sql_func.count(AnalysisHistory.id).label("count"),
            )
            .filter(AnalysisHistory.created_at >= window_start)
            .group_by(
                sql_func.date(AnalysisHistory.created_at),
                AnalysisHistory.tool_type,
            )
            .order_by(sql_func.date(AnalysisHistory.created_at))
            .all()
        )
        daily_tool_usage = [
            DailyToolDataPoint(date=str(row.date), tool_type=row.tool_type, count=row.count)
            for row in daily_tool_q
        ]

        return AdminAnalyticsResponse(
            total_users=total_users,
            active_today=active_today,
            total_revenue_usd=total_revenue_usd,
            most_used_feature=most_used_feature,
            daily_signups=daily_signups,
            daily_tool_usage=daily_tool_usage,
            tool_distribution=tool_distribution,
            top_tools=top_tools,
            total_analyses=total_analyses,
            total_credits_consumed=total_credits_consumed,
            avg_score=avg_score,
        )

    except Exception as e:
        logger.error("Admin analytics error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch analytics")


# ═══════════════════════════════════════════════════════════════════════════
#  4. POST /admin/users/{user_id}/ban — Ban/unban a user
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/users/{user_id}/ban", response_model=BanResponse)
async def ban_user(
    user_id: str,
    data: BanRequest,
    admin: dict = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Ban or unban a user. Banned users receive 403 on all subsequent requests."""

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    # Prevent self-ban
    if user_id == admin.get("id"):
        raise HTTPException(status_code=400, detail="Cannot ban yourself")

    # Prevent banning other admins
    if target.role == "admin" and data.banned:
        raise HTTPException(status_code=400, detail="Cannot ban another admin")

    target.is_banned = data.banned
    target.ban_reason = data.reason if data.banned else None
    db.commit()

    action = "BANNED" if data.banned else "UNBANNED"
    logger.warning(
        "Admin %s user | target=%s (%s) | reason=%s | admin=%s",
        action, user_id, target.email, data.reason, admin.get("id"),
    )

    return BanResponse(
        user_id=user_id,
        email=target.email or "",
        is_banned=target.is_banned,
        reason=target.ban_reason,
    )
