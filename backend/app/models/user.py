from sqlalchemy import Column, String, Integer, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    """
    Local mirror of the User.
    The 'id' here should match the 'sub' (UUID) from Supabase Auth.
    """
    __tablename__ = "users"

    # 1. Primary Key
    # We use String to store the Supabase UUID safely.
    id = Column(String, primary_key=True, index=True)

    # 2. Identity
    email = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    # 3. Role
    role = Column(String, default="student", nullable=False,
                  comment="student | recruiter")

    # 4. Subscription Status
    is_pro = Column(Boolean, default=False)       # True if they bought a premium pack
    plan_type = Column(String, default="free")    # e.g., "free", "pro_monthly"

    # 5. Admin flags
    is_banned = Column(Boolean, default=False)    # True = 403 on all requests
    ban_reason = Column(String, nullable=True)    # Admin-provided reason

    # 6. Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    last_active = Column(DateTime(timezone=True), nullable=True)  # Updated by middleware

    # 5. Relationships
    # Access these easily: user.profile.full_name or user.credits.balance
    
    # 1-to-1 with Profile
    profile = relationship("UserProfile", backref="user", uselist=False, cascade="all, delete-orphan")
    
    # 1-to-1 with Credits
    # credits = relationship("UserCredits", backref="user", uselist=False, cascade="all, delete-orphan")

    # 1-to-Many with Resumes
    # resumes = relationship("Resume", backref="owner", cascade="all, delete-orphan")