"""
History API — View past analyses.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.analysis_history import AnalysisHistory

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class HistoryItem(BaseModel):
    id: int
    tool_type: str
    title: Optional[str]
    input_summary: Optional[str]
    score: Optional[int]
    created_at: str


class HistoryDetail(BaseModel):
    id: int
    tool_type: str
    title: Optional[str]
    input_summary: Optional[str]
    result_data: str
    score: Optional[int]
    created_at: str


class HistoryListResponse(BaseModel):
    items: List[HistoryItem]
    total: int


# --- Helper: Save analysis (called from other endpoints) ---
def save_analysis(
    db: Session,
    user_id: str,
    tool_type: str,
    title: str,
    input_summary: str,
    result_data: str,
    score: Optional[int] = None,
):
    """Saves an analysis result to history."""
    try:
        entry = AnalysisHistory(
            user_id=user_id,
            tool_type=tool_type,
            title=title,
            input_summary=input_summary[:500] if input_summary else "",
            result_data=result_data if isinstance(result_data, str) else json.dumps(result_data),
            score=score,
        )
        db.add(entry)
        db.commit()
        logger.info(f"Saved {tool_type} analysis for user {user_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save analysis: {e}")


# --- Endpoints ---

@router.get("/", response_model=HistoryListResponse)
async def list_history(
    tool_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List past analyses with optional tool_type filter."""
    user_id = user.get("id")

    query = db.query(AnalysisHistory).filter(AnalysisHistory.user_id == user_id)

    if tool_type:
        query = query.filter(AnalysisHistory.tool_type == tool_type)

    total = query.count()
    results = query.order_by(AnalysisHistory.created_at.desc()).offset(offset).limit(limit).all()

    items = [
        HistoryItem(
            id=r.id,
            tool_type=r.tool_type,
            title=r.title,
            input_summary=r.input_summary,
            score=r.score,
            created_at=str(r.created_at) if r.created_at else "",
        )
        for r in results
    ]

    return HistoryListResponse(items=items, total=total)


@router.get("/{history_id}", response_model=HistoryDetail)
async def get_history_detail(
    history_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full detail of a single past analysis."""
    user_id = user.get("id")

    entry = db.query(AnalysisHistory).filter(
        AnalysisHistory.id == history_id,
        AnalysisHistory.user_id == user_id,
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return HistoryDetail(
        id=entry.id,
        tool_type=entry.tool_type,
        title=entry.title,
        input_summary=entry.input_summary,
        result_data=entry.result_data,
        score=entry.score,
        created_at=str(entry.created_at) if entry.created_at else "",
    )
