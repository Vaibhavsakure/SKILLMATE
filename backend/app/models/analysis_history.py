"""
Analysis History Model — Stores all past AI analyses.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class AnalysisHistory(Base):
    """Immutable log of every AI analysis performed by a user."""
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), nullable=False, index=True)
    tool_type = Column(String(50), nullable=False)  # e.g. "resume_rewrite", "ats_score", "cover_letter"
    title = Column(String(200), nullable=True)       # e.g. "Software Engineer at Google"
    input_summary = Column(Text, nullable=True)      # Truncated input for display
    result_data = Column(Text, nullable=False)        # Full JSON or text result
    score = Column(Integer, nullable=True)            # Optional score (ATS, Job Match)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
