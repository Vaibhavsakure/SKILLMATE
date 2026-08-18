"""
Database Base — the single import that registers every model on Base.metadata.

Both Base.metadata.create_all() (main.py lifespan) and Alembic autogenerate
(alembic/env.py) rely on this module, so a model missing here silently means a
missing table at startup and a spurious "drop table" in the next migration.
Add every new model below.
"""

from app.core.database import Base

# Import ALL models so Alembic and create_all can detect them
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.usage import UsageLog
from app.models.usage_credit import UsageCredit
from app.models.resume import Resume
from app.models.resume_version import ResumeVersion
from app.models.job_description import JobDescription
from app.models.ats_score import ATSScore
from app.models.analysis_history import AnalysisHistory
from app.models.task_queue import AsyncTask
from app.models.user_context import UserContext
from app.models.webhook_event import ProcessedWebhookEvent
from app.models.recruiter_models import RecruiterJob, Candidate

__all__ = [
    "Base",
    "User",
    "UserProfile",
    "UserCredits",
    "CreditTransaction",
    "UsageLog",
    "UsageCredit",
    "Resume",
    "ResumeVersion",
    "JobDescription",
    "ATSScore",
    "AnalysisHistory",
    "AsyncTask",
    "UserContext",
    "ProcessedWebhookEvent",
    "RecruiterJob",
    "Candidate",
]
