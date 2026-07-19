import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    # 1. Primary Key (UUID)
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 2. Metadata (Optional but recommended for UI)
    title = Column(String, nullable=True, comment="e.g. Senior Python Developer")
    company_name = Column(String, nullable=True, comment="e.g. Google")
    source_url = Column(String, nullable=True, comment="Link to the LinkedIn/Indeed post")

    # 3. The Core Content
    # Changed to 'Text' type to handle very long JDs (unlimited length)
    text = Column(Text, nullable=False)

    # 4. Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 5. Relationships
    # This allows you to see all ATS scores associated with this JD
    # (Make sure ATSScore model has 'jd_id' foreign key defined)
    ats_scores = relationship("ATSScore", backref="job_description", cascade="all, delete-orphan")