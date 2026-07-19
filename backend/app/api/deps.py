"""
Skillmate Backend — Authentication & Authorization Dependencies
================================================================
SINGLE SOURCE OF TRUTH for auth. All routes import from here.
"""

import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from supabase import create_client, Client

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

# --- 1. Initialize Supabase Client (Once at startup) ---
_supabase: Optional[Client] = None

if settings.supabase_url and settings.supabase_anon_key:
    try:
        _supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
        logger.info("✅ Supabase client initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Supabase client: {e}")

# Security Scheme
security = HTTPBearer(auto_error=False)


# --- 2. Core Auth Dependency ---
async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Validates the Bearer token using Supabase Auth.
    Returns a CONSISTENT user dict: {"id": str, "email": str, "role": str}
    """

    # A. Check if token exists
    if not creds or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = creds.credentials

    # B. Check if Supabase is configured
    if not _supabase:
        if settings.env == "development" and settings.allow_dev_mock_auth:
            logger.warning("⚠️ Dev Mode (Mock Auth) enabled via ALLOW_DEV_MOCK_AUTH")
            return {
                "id": "dev_user_123",
                "email": "dev@example.com",
                "role": "authenticated",
            }
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not configured.",
        )

    # C. Verify Token with Supabase
    try:
        user_response = _supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or expired session",
            )

        user = user_response.user
        return {
            "id": user.id,
            "email": user.email,
            "role": user.role or "authenticated",
            "user_metadata": user.user_metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        if settings.env == "development" and settings.allow_dev_mock_auth:
            logger.warning(f"⚠️ Dev Mode fallback auth due to Supabase validation error: {e}")
            return {
                "id": "dev_user_123",
                "email": "dev@example.com",
                "role": "authenticated",
            }
        logger.warning(f"Auth validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# --- 3. Credit Check Dependency ---
def require_credits(cost: int = 1):
    """
    Dependency factory — gates an endpoint behind a credit balance check.

    Uses Depends(get_db) so the SAME SQLAlchemy session is shared with the
    calling route. FastAPI deduplicates the dependency: get_db is called once
    per request and the session is closed automatically by the generator when
    the response is sent — no manual db.close() needed.

    Usage:
        @router.post("/endpoint")
        async def my_route(user=Depends(require_credits(cost=2)), db=Depends(get_db)):
            ...
    """
    from app.services.credit_service import get_user_credits

    async def checker(
        current_user: dict = Depends(get_current_user),
        db: Session = Depends(get_db),          # shared session — no SessionLocal()
    ) -> dict:
        wallet = get_user_credits(db, current_user["id"])
        if wallet.credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=(
                    f"Insufficient credits. "
                    f"Required: {cost}, Available: {wallet.credits}"
                ),
            )
        return current_user

    return checker


# --- 4. Role Check Dependency ---
def require_role(required_role: str):
    """
    Dependency factory — gates an endpoint behind a DB-verified role check.

    Uses Depends(get_db) for the same session-sharing reasons as require_credits.
    Falls back to Supabase user_metadata if the user row doesn't exist in the
    local DB yet (e.g. first login before the sync job runs).

    Usage:
        @router.post("/endpoint")
        async def my_route(user=Depends(require_role("recruiter"))):
            ...
    """
    from app.models.user import User

    async def checker(
        current_user: dict = Depends(get_current_user),
        db: Session = Depends(get_db),          # shared session — no SessionLocal()
    ) -> dict:
        db_user = db.query(User).filter(User.id == current_user["id"]).first()

        if db_user:
            user_role = db_user.role
        else:
            # Fallback: Supabase user_metadata (before local DB row is created)
            metadata = current_user.get("user_metadata", {}) or {}
            user_role = metadata.get("role", "student")

        if user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This endpoint requires '{required_role}' role. "
                    f"Your role: '{user_role}'"
                ),
            )
        return current_user

    return checker