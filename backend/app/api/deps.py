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
from starlette.concurrency import run_in_threadpool
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
    # supabase-py's auth client is synchronous — calling it directly from an
    # async dependency blocks the event loop for the whole network round-trip
    # on every authenticated request. Push it to the threadpool.
    try:
        user_response = await run_in_threadpool(_supabase.auth.get_user, token)

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


# --- 4. Role Resolution & Check ---
def resolve_user_role(db: Session, current_user: dict) -> str:
    """
    Return the authoritative application role for a user.

    The local `users.role` column is the only trusted source. Supabase's
    `user.role` is always "authenticated" (a Postgres role, not our role), and
    `user_metadata` is writable by the client via supabase.auth.updateUser(),
    so neither can gate access. A user with no local row yet is a plain
    "student" until they pick a role through POST /api/v1/users/me/role.
    """
    from app.models.user import User

    db_user = db.query(User).filter(User.id == current_user.get("id")).first()
    if db_user and db_user.role:
        return db_user.role
    return "student"


def require_role(required_role: str):
    """
    Dependency factory — gates an endpoint behind a DB-verified role check.

    Uses Depends(get_db) for the same session-sharing reasons as require_credits.

    Usage:
        @router.post("/endpoint")
        async def my_route(user=Depends(require_role("recruiter"))):
            ...
    """

    async def checker(
        current_user: dict = Depends(get_current_user),
        db: Session = Depends(get_db),          # shared session — no SessionLocal()
    ) -> dict:
        user_role = resolve_user_role(db, current_user)

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


# --- 5. Admin Check Dependency ---
async def require_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Gates an endpoint behind superuser access.

    A user qualifies if their local row has is_superuser=True, or if their id
    or email is listed in the ADMIN_USER_IDS setting. With neither configured
    the endpoint is closed — admin data is never open by default.
    """
    from app.models.user import User

    user_id = current_user.get("id")
    email = (current_user.get("email") or "").lower()

    allowlist = {str(v).strip().lower() for v in (settings.admin_user_ids or []) if v}
    if user_id and str(user_id).lower() in allowlist:
        return current_user
    if email and email in allowlist:
        return current_user

    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user and db_user.is_superuser:
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator access required.",
    )
