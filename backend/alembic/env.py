"""
Alembic Environment Configuration for Skillmate AI Backend.
Connects to the same database as the main app via app.core.config.
"""

import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure the backend root is on sys.path so 'app' is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import settings and Base
from app.core.config import settings
from app.core.database import Base

# --- Import ALL models here so Alembic autogenerate can detect them ---
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.analysis_history import AnalysisHistory
from app.models.resume_version import ResumeVersion
from app.models.task_queue import AsyncTask
from app.models.usage import UsageLog
from app.models.resume import Resume
from app.models.ats_score import ATSScore
from app.models.job_description import JobDescription
from app.models.usage_credit import UsageCredit
from app.models.recruiter_models import RecruiterJob, Candidate

# Alembic Config object
config = context.config

# Override the sqlalchemy.url from the .ini with our app settings
config.set_main_option("sqlalchemy.url", settings.database_url)

# Setup loggers
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # Required for SQLite ALTER TABLE support
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE support
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
