"""
Admin Analytics API ΓÇö Usage tracking and admin dashboard data.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.core.database import get_db
from app.api.deps import require_admin
from app.models.analysis_history import AnalysisHistory
from app.models.credit_models import UserCredits, CreditTransaction

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class ToolUsage(BaseModel):
    tool_type: str
    count: int


class DailyActivity(BaseModel):
    date: str
    analyses: int


class AdminAnalyticsResponse(BaseModel):
    total_users: int
    total_analyses: int
    total_credits_consumed: int
    tool_usage: List[ToolUsage]
    recent_activity: List[DailyActivity]
    avg_score: int
    top_tools: List[str]


# --- Endpoints ---

@router.get("/analytics", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Returns aggregated analytics for the admin dashboard.

    Requires superuser access ΓÇö this aggregates every user's activity, so it
    is gated by require_admin rather than plain authentication.
    """

    try:
        # Total unique users
        total_users = db.query(
            sql_func.count(sql_func.distinct(AnalysisHistory.user_id))
        ).scalar() or 0

        # Total analyses
        total_analyses = db.query(
            sql_func.count(AnalysisHistory.id)
        ).scalar() or 0

        # Total credits consumed
        total_credits = db.query(
            sql_func.sum(sql_func.abs(CreditTransaction.change))
        ).filter(CreditTransaction.change < 0).scalar() or 0

        # Tool usage distribution
        tool_counts = (
            db.query(
                AnalysisHistory.tool_type,
                sql_func.count(AnalysisHistory.id).label("count")
            )
            .group_by(AnalysisHistory.tool_type)
            .order_by(sql_func.count(AnalysisHistory.id).desc())
            .all()
        )
        tool_usage = [ToolUsage(tool_type=t[0], count=t[1]) for t in tool_counts]
        top_tools = [t[0] for t in tool_counts[:5]]

        # Recent daily activity (last 7 days)
        daily = (
            db.query(
                sql_func.date(AnalysisHistory.created_at).label("date"),
                sql_func.count(AnalysisHistory.id).label("count")
            )
            .group_by(sql_func.date(AnalysisHistory.created_at))
            .order_by(sql_func.date(AnalysisHistory.created_at).desc())
            .limit(7)
            .all()
        )
        recent_activity = [
            DailyActivity(date=str(d[0]), analyses=d[1]) for d in daily
        ]

        # Average score
        avg = db.query(sql_func.avg(AnalysisHistory.score)).filter(
            AnalysisHistory.score.isnot(None)
        ).scalar()
        avg_score = int(avg) if avg else 0

        return AdminAnalyticsResponse(
            total_users=total_users,
            total_analyses=total_analyses,
            total_credits_consumed=total_credits,
            tool_usage=tool_usage,
            recent_activity=recent_activity,
            avg_score=avg_score,
            top_tools=top_tools,
        )

    except Exception as e:
        logger.error(f"Admin analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch analytics")
