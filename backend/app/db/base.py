"""
Database Base — Import all models here for Alembic migration detection.
"""

from app.core.database import Base

# Import ALL models so Alembic can detect them
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.usage import UsageLog
from app.models.recruiter_models import RecruiterJob, Candidate