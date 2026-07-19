from sqlalchemy import Column, String, Integer, DateTime, CheckConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class UsageCredit(Base):
    """
    Simple model to track user credit balance.
    """
    __tablename__ = "usage_credits"

    user_id = Column(String, primary_key=True, index=True)
    credits_remaining = Column(Integer, default=5, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('credits_remaining >= 0', name='check_credits_positive'),
    )