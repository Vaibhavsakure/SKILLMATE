"""
Skillmate Backend — Unified Database Configuration
=====================================================
This is the SINGLE SOURCE OF TRUTH for database connections.
All models and services MUST import from here.
"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

# 1. Create the Database Engine
# pool_pre_ping=True prevents "server has gone away" errors in production.
_is_sqlite = "sqlite" in settings.database_url

engine_kwargs = {
    "pool_pre_ping": True,
}

if _is_sqlite:
    # SQLite needs this flag & doesn't support pool_size / pool overflow
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pooling for production
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(settings.database_url, **engine_kwargs)

logger.info(f"📦 Database engine created ({'SQLite' if _is_sqlite else 'PostgreSQL'})")

# 2. Create the Session Factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# 3. Base Class for ALL Models
# Every model (User, Credits, Resume, etc.) MUST inherit from this.
Base = declarative_base()

# 4. Dependency Helper for FastAPI routes
# Usage: db: Session = Depends(get_db)
def get_db():
    """Creates a scoped database session for a single request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()