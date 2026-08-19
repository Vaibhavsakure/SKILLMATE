"""
Skillmate AI — Test Configuration & Shared Fixtures
=====================================================
Provides:
  - In-memory SQLite test database with all models
  - Mock Supabase auth override (bypasses JWT validation)
  - AsyncClient for testing FastAPI endpoints
  - Pre-seeded test users with credits
"""

import uuid
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from httpx import ASGITransport, AsyncClient

# ── Import the Base and all models so they are registered ──────────
# This ensures create_all() builds every table.
from app.core.database import Base, get_db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.credit_models import UserCredits, CreditTransaction
from app.models.resume import Resume
from app.models.resume_version import ResumeVersion
from app.models.analysis_history import AnalysisHistory
from app.models.recruiter_models import RecruiterJob, Candidate

# Auth dependency we'll override
from app.api.deps import get_current_user

# The FastAPI app
from main import app


# ============================================================
#  1. Test Database — In-Memory SQLite
# ============================================================

# "sqlite:///file::memory:?cache=shared" was passed through to sqlite3 as a
# literal *filename*, because the shared-cache URI form also needs uri=True in
# connect_args. Every connection therefore failed with
# "sqlite3.OperationalError: unable to open database file".
#
# A plain in-memory database plus StaticPool is simpler and gives the same
# property the shared cache was after: every connection sees the same tables.
TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables once at the start of the test session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    """Provides a clean database session per test, rolled back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


def _override_get_db(session: Session):
    """Creates a get_db override that yields the test session."""
    def _get_db():
        try:
            yield session
        finally:
            pass  # session lifecycle managed by the db fixture
    return _get_db


# ============================================================
#  2. Mock Auth — Fake Users
# ============================================================

# Pre-defined test user IDs
TEST_USER_ID = "test-user-" + str(uuid.uuid4())[:8]
TEST_RECRUITER_ID = "test-recruiter-" + str(uuid.uuid4())[:8]

# Mock user dicts matching the shape returned by deps.get_current_user
MOCK_STUDENT_USER = {
    "id": TEST_USER_ID,
    "email": "student@test.com",
    "role": "authenticated",
    "user_metadata": {"role": "student"},
}

MOCK_RECRUITER_USER = {
    "id": TEST_RECRUITER_ID,
    "email": "recruiter@test.com",
    "role": "authenticated",
    "user_metadata": {"role": "recruiter"},
}


def _mock_auth_student():
    """Override get_current_user → returns a student user."""
    async def _override():
        return MOCK_STUDENT_USER
    return _override


def _mock_auth_recruiter():
    """Override get_current_user → returns a recruiter user."""
    async def _override():
        return MOCK_RECRUITER_USER
    return _override


def _mock_auth_none():
    """Override get_current_user → raises 401 (simulates missing token)."""
    from fastapi import HTTPException, status

    async def _override():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )
    return _override


# ============================================================
#  3. Async Test Client
# ============================================================

@pytest_asyncio.fixture()
async def student_client(db: Session) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated AsyncClient as a STUDENT user with seeded credits."""
    # Seed database with student user and credits
    _seed_user(db, MOCK_STUDENT_USER, role="student", credits=10)

    # Override dependencies
    app.dependency_overrides[get_db] = _override_get_db(db)
    app.dependency_overrides[get_current_user] = _mock_auth_student()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def recruiter_client(db: Session) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated AsyncClient as a RECRUITER user."""
    _seed_user(db, MOCK_RECRUITER_USER, role="recruiter", credits=20)

    app.dependency_overrides[get_db] = _override_get_db(db)
    app.dependency_overrides[get_current_user] = _mock_auth_recruiter()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def unauthenticated_client(db: Session) -> AsyncGenerator[AsyncClient, None]:
    """Unauthenticated AsyncClient — all auth-gated routes should return 401."""
    app.dependency_overrides[get_db] = _override_get_db(db)
    app.dependency_overrides[get_current_user] = _mock_auth_none()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def no_credits_client(db: Session) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated AsyncClient as a student with ZERO credits."""
    _seed_user(db, MOCK_STUDENT_USER, role="student", credits=0)

    app.dependency_overrides[get_db] = _override_get_db(db)
    app.dependency_overrides[get_current_user] = _mock_auth_student()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ============================================================
#  4. Seed Helpers
# ============================================================

def _seed_user(db: Session, user_dict: dict, role: str = "student", credits: int = 5):
    """Insert a User + UserCredits row into the test database."""
    user_id = user_dict["id"]

    # Check if user already exists (avoid duplicate key on re-run)
    existing = db.query(User).filter(User.id == user_id).first()
    if not existing:
        user = User(
            id=user_id,
            email=user_dict["email"],
            role=role,
        )
        db.add(user)

    # Upsert credits
    wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
    if wallet:
        wallet.credits = credits
    else:
        wallet = UserCredits(user_id=user_id, credits=credits)
        db.add(wallet)

    db.commit()


def seed_recruiter_job(db: Session, recruiter_id: str, **kwargs) -> RecruiterJob:
    """Helper: Create a test recruiter job and return it."""
    defaults = {
        "hr_user_id": recruiter_id,
        "title": "Senior Python Engineer",
        "company_name": "TestCorp",
        "jd_text": "We need a senior Python engineer with FastAPI and AWS experience.",
        "required_skills": "Python, FastAPI, AWS, Docker",
        "experience_level": "senior",
        "score_threshold": 60,
    }
    defaults.update(kwargs)

    job = RecruiterJob(**defaults)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
