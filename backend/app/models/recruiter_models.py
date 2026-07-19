"""
Skillmate Backend — Recruiter Portal Models
=============================================
RecruiterJob  : Job openings created by HR / Recruiters
Candidate     : Scored applicants (bulk-uploaded CVs or job-seeker applications)
"""

import uuid
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RecruiterJob(Base):
    """
    A job opening posted by a recruiter (role='recruiter').
    """
    __tablename__ = "recruiter_jobs"

    # --- Primary Key (UUID) ---
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # --- Owner ---
    hr_user_id = Column(String(36), nullable=False, index=True,
                        comment="Supabase user ID of the recruiter who created this job")

    # --- Job Details ---
    title = Column(String(200), nullable=False, comment="e.g. Senior Backend Engineer")
    company_name = Column(String(200), nullable=True, comment="e.g. Acme Corp")
    jd_text = Column(Text, nullable=False, comment="Full job description text")
    required_skills = Column(Text, nullable=True,
                             comment="Comma-separated skills or JSON array")
    experience_level = Column(String(50), nullable=True, default="mid",
                              comment="junior / mid / senior / lead")
    score_threshold = Column(Integer, nullable=False, default=60,
                             comment="Minimum overall_score (0-100) for auto-shortlist")
    calendly_link = Column(String(500), nullable=True,
                           comment="Optional scheduling link sent on approval")

    # --- Status ---
    is_active = Column(Boolean, default=True, comment="False = closed / archived")

    # --- Timestamps ---
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # --- Relationships ---
    candidates = relationship(
        "Candidate",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="Candidate.overall_score.desc()",
    )

    def __repr__(self):
        return f"<RecruiterJob {self.title} by {self.hr_user_id}>"


class Candidate(Base):
    """
    A candidate evaluated against a RecruiterJob.
    Source can be 'upload' (bulk CV) or 'applied' (job seeker self-applied).
    """
    __tablename__ = "candidates"

    # --- Primary Key ---
    id = Column(Integer, primary_key=True, autoincrement=True)

    # --- Foreign Key → Job ---
    job_id = Column(String, ForeignKey("recruiter_jobs.id", ondelete="CASCADE"),
                    nullable=False, index=True)

    # --- Applicant Identity ---
    applicant_user_id = Column(String(36), nullable=True, index=True,
                               comment="Set when a Skillmate user applies; null for bulk uploads")
    applicant_name = Column(String(200), nullable=True, comment="Extracted from CV by AI")
    applicant_email = Column(String(200), nullable=True, comment="Extracted from CV or user profile")

    # --- CV Data ---
    cv_text = Column(Text, nullable=False, comment="Full extracted resume text")
    cv_filename = Column(String(300), nullable=True, comment="Original uploaded filename")

    # --- AI Scoring ---
    overall_score = Column(Integer, nullable=True, default=0, comment="0-100 overall fit")
    skills_match = Column(Integer, nullable=True, default=0, comment="0-100 skills alignment")
    experience_fit = Column(Integer, nullable=True, default=0, comment="0-100 experience relevance")
    red_flags = Column(Text, nullable=True, comment="JSON array of concerns")
    green_flags = Column(Text, nullable=True, comment="JSON array of strengths")
    summary = Column(Text, nullable=True, comment="One-paragraph AI summary")
    recommendation = Column(String(20), nullable=True, default="pending",
                            comment="strong_yes / yes / maybe / no")

    # --- Status ---
    status = Column(String(20), nullable=False, default="pending",
                    comment="pending / approved / rejected")
    source = Column(String(20), nullable=False, default="upload",
                    comment="upload (bulk) / applied (job seeker)")

    # --- Timestamps ---
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    # --- Relationships ---
    job = relationship("RecruiterJob", back_populates="candidates")

    def __repr__(self):
        return f"<Candidate {self.applicant_name} score={self.overall_score} for job={self.job_id}>"
