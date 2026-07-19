"""
Task Queue Model — Database-backed async task tracking.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class AsyncTask(Base):
    """Tracks long-running AI tasks for polling-based progress."""
    __tablename__ = "async_tasks"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    task_type = Column(String(50), nullable=False)  # e.g. "resume_rewrite", "cover_letter"
    status = Column(String(20), nullable=False, default="pending")  # pending, processing, completed, failed
    input_data = Column(Text, nullable=True)  # JSON input
    result_data = Column(Text, nullable=True)  # JSON result
    error_message = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
