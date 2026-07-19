"""
Stats API — Real-time dashboard statistics.
"""

import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.analysis_history import AnalysisHistory

logger = logging.getLogger(__name__)

router = APIRouter()


class StatsOverview(BaseModel):
    total_analyses: int
    credits_remaining: int
    avg_score: int
    tools_used: int
    recent_tool: str


@router.get("/overview", response_model=StatsOverview)
async def get_stats_overview(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns real dashboard statistics for the current user."""
    user_id = user.get("id")

    try:
        # 1. Total analyses
        total = db.query(sql_func.count(AnalysisHistory.id)).filter(
            AnalysisHistory.user_id == user_id
        ).scalar() or 0

        # 2. Credits remaining
        wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
        credits = wallet.credits if wallet else 5  # Default 5 for new users

        # 3. Average score (from analyses that have a score)
        avg = db.query(sql_func.avg(AnalysisHistory.score)).filter(
            AnalysisHistory.user_id == user_id,
            AnalysisHistory.score.isnot(None),
        ).scalar()
        avg_score = int(avg) if avg else 0

        # 4. Distinct tools used
        tools_count = db.query(sql_func.count(sql_func.distinct(AnalysisHistory.tool_type))).filter(
            AnalysisHistory.user_id == user_id
        ).scalar() or 0

        # 5. Most recently used tool
        latest = db.query(AnalysisHistory.tool_type).filter(
            AnalysisHistory.user_id == user_id
        ).order_by(AnalysisHistory.created_at.desc()).first()
        recent_tool = latest[0] if latest else "None yet"

        return StatsOverview(
            total_analyses=total,
            credits_remaining=credits,
            avg_score=avg_score,
            tools_used=tools_count,
            recent_tool=recent_tool,
        )

    except Exception as e:
        logger.error(f"Stats error for {user_id}: {e}")
        return StatsOverview(
            total_analyses=0,
            credits_remaining=5,
            avg_score=0,
            tools_used=0,
            recent_tool="None yet",
        )
