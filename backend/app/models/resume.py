import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Resume(Base):
    """
    The parent container for a user's resume.
    A user uploads a file -> We create a 'Resume'.
    Every time they rewrite it -> We add a 'ResumeVersion'.
    """
    __tablename__ = "resumes"

    # 1. Primary Key
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 2. Ownership
    # Stores the Supabase User ID. Indexed for fast dashboard loading.
    user_id = Column(String, nullable=False, index=True)

    # 3. Metadata
    # 'title' helps users identify resumes if they have multiple (e.g. "Frontend Resume")
    title = Column(String, nullable=True, default="Untitled Resume")
    filename = Column(String, nullable=False)
    
    # 4. Core Content
    # Stores the text extracted from the *original* uploaded file.
    extracted_text = Column(Text, nullable=False, server_default="")

    # 5. Storage
    # Public URL (S3/R2) or local path where the original file lives.
    # Populated by the upload endpoint; used by migrate_uploads_to_s3.py.
    file_url = Column(String, nullable=True)       # None = local-only / legacy row

    # 5. Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # 6. Relationships
    # One Resume has MANY Versions (History of edits)
    versions = relationship("ResumeVersion", back_populates="resume", cascade="all, delete-orphan")