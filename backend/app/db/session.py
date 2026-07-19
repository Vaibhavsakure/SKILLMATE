"""
Backward-compatibility re-export.
Canonical database config lives in app.core.database.
"""

from app.core.database import engine, SessionLocal, Base, get_db

__all__ = ["engine", "SessionLocal", "Base", "get_db"]