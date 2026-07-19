import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class UserCredits(Base):
    """
    Stores the current balance for a user.
    """
    __tablename__ = "user_credits"

    # Using String for UUID to ensure SQLite compatibility
    user_id = Column(String(36), primary_key=True)
    credits = Column(Integer, default=5)  # Default 5 free credits on sign-up
    
    # Metadata
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship: One User has Many Transactions
    transactions = relationship("CreditTransaction", back_populates="user_credit_record", cascade="all, delete-orphan", foreign_keys="CreditTransaction.user_id")


class CreditTransaction(Base):
    """
    Immutable log of every credit change (usage or purchase).
    """
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign Key links to the UserCredits table
    user_id = Column(String(36), ForeignKey("user_credits.user_id"), nullable=False, index=True)
    
    # 'change' allows positive (purchase) and negative (usage) values
    change = Column(Integer, nullable=False)  # e.g., -1 or +10
    
    # 'reason' describes the action (e.g., "resume_rewrite", "purchase_pack_small")
    reason = Column(String, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to the balance record
    user_credit_record = relationship("UserCredits", back_populates="transactions", foreign_keys=[user_id])