import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class ResumeVersion(Base):
    """
    Stores snapshots of a resume.
    Every time a user uploads or rewrites a resume, a new version is saved here.
    """
    __tablename__ = "resume_versions"

    # 1. Primary Key (UUID)
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 2. Foreign Key to Parent Resume
    # This links this specific version to the main Resume container
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False, index=True)

    # 3. Content Storage
    # Stores the parsed structured data (perfect for frontend UI)
    content_json = Column(JSON, nullable=True) 
    # Stores the full raw text (perfect for AI re-processing)
    raw_text = Column(Text, nullable=True)

    # 4. Versioning Metadata
    version_number = Column(Integer, nullable=False, default=1)  # e.g., 1, 2, 3
    is_enhanced = Column(Boolean, default=False)                 # True if AI-generated
    enhancement_note = Column(String, nullable=True)             # e.g. "Rewritten with Executive Tone"

    # 5. Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 6. Relationships
    # Ensure your 'Resume' model has: versions = relationship("ResumeVersion", ...)
    resume = relationship("Resume", back_populates="versions")