"""
UserContext Model — Stores the user's active resume and job description.
=========================================================================
Single source of truth so users only upload/paste once.
"""

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class UserContext(Base):
    """Stores the user's current resume text and target job description."""
    __tablename__ = "user_contexts"

    user_id = Column(String, primary_key=True, index=True)

    # Resume data
    resume_text = Column(Text, nullable=True)
    resume_filename = Column(String, nullable=True)

    # Job description data
    job_description = Column(Text, nullable=True)
    jd_title = Column(String, nullable=True, comment="e.g. Senior Frontend Dev at Google")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
