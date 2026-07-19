import uuid
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID  # Only if using Postgres
from sqlalchemy.sql import func
from app.core.database import Base

class UsageLog(Base):
    """
    An immutable audit log for analytics. 
    Tracks every action a user performs (e.g. 'rewrite_resume', 'download_pdf').
    """
    __tablename__ = "usage_logs"

    # 1. Primary Key
    # using String for ID is safer across different databases, but UUID(as_uuid=True) is fine for Postgres
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 2. User Link
    # Index=True makes querying "User X's activity" very fast
    user_id = Column(String, nullable=False, index=True)

    # 3. Action Details
    action = Column(String, nullable=False)      # e.g. "resume_rewrite"
    resource_id = Column(String, nullable=True)  # e.g. The ID of the resume being edited
    credits_used = Column(Integer, default=0)    # Cost of the action

    # 4. Metadata
    # e.g. Store "Target Role: Manager" or "Tone: Professional" for analytics
    details = Column(String, nullable=True) 

    # 5. Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())