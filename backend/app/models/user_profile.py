from sqlalchemy import Column, String, Integer, ForeignKey, JSON, Text, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserProfile(Base):
    """
    Stores the user's core career identity.
    """
    __tablename__ = "user_profiles"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)

    full_name = Column(String, nullable=True)
    headline = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)

    experience_level = Column(String)
    years_experience = Column(Float, default=0.0)
    preferred_role = Column(String)

    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)

    skills = Column(JSON, default=[])

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())