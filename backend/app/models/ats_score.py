import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, JSON, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class ATSScore(Base):
    __tablename__ = "ats_scores"

    # 1. Primary Key (UUID is better for distributed systems than Integer)
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 2. Foreign Keys
    # Note: Ensure the "resumes" and "job_descriptions" tables exist.
    # If you don't have a "job_descriptions" table yet, remove that ForeignKey.
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False, index=True)
    jd_id = Column(String, ForeignKey("job_descriptions.id"), nullable=True)

    # 3. Score Metrics
    total_score = Column(Integer, nullable=False)
    match_percentage = Column(Integer, default=0)  # Distinct from total score (e.g., keyword match vs format match)
    
    # 4. JSON Data (Stores 'missing_keywords', 'formatting_issues', etc.)
    section_scores = Column(JSON, default={})

    # 5. Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 6. Relationships (Optional - Comment out if Models don't exist yet)
    # resume = relationship("Resume", back_populates="ats_scores")
    # job_description = relationship("JobDescription", back_populates="ats_scores")