"""
User Role API — Role Management Endpoints
===========================================
GET  /me/role  — Get current user's role (creates User record if missing)
POST /me/role  — Set user role (called during signup)
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Schemas ---

class RoleResponse(BaseModel):
    role: str
    email: str
    user_id: str


class SetRoleRequest(BaseModel):
    role: str  # "student" | "recruiter"


class SetRoleResponse(BaseModel):
    role: str
    message: str


# --- Helpers ---

def _get_or_create_user(db: Session, user_data: dict) -> User:
    """
    Get existing User from DB, or create one on first login.
    Checks Supabase user_metadata for role as a fallback.
    """
    user_id = user_data["id"]
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        # First-time login — create local User record
        metadata = user_data.get("user_metadata", {}) or {}
        role = metadata.get("role", "student")

        user = User(
            id=user_id,
            email=user_data.get("email", ""),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"👤 Created User record: {user_id} (role={role})")

        # Fire welcome email (non-blocking — errors are logged, never raised)
        user_email = user_data.get("email", "")
        user_name = (
            user_data.get("user_metadata", {}).get("full_name")
            or user_data.get("user_metadata", {}).get("name")
            or user_email.split("@")[0]
        )
        if user_email:
            asyncio.ensure_future(email_service.send_welcome_email(user_email, user_name))

    return user


# --- Endpoints ---

@router.get("/me/role", response_model=RoleResponse)
async def get_user_role(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the current user's role from the database.
    Auto-creates the User record if it doesn't exist yet (first login).
    Falls back to Supabase user_metadata.role if no DB record.
    """
    db_user = _get_or_create_user(db, user)

    return RoleResponse(
        role=db_user.role or "student",
        email=db_user.email or user.get("email", ""),
        user_id=db_user.id,
    )


@router.post("/me/role", response_model=SetRoleResponse)
async def set_user_role(
    data: SetRoleRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Set the user's role. Called during signup flow.
    Only allows 'student' or 'recruiter'.
    """
    if data.role not in ("student", "recruiter"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'student' or 'recruiter'",
        )

    db_user = _get_or_create_user(db, user)
    db_user.role = data.role
    db.commit()

    logger.info(f"👤 User {db_user.id} role set to '{data.role}'")

    return SetRoleResponse(
        role=data.role,
        message=f"Role updated to '{data.role}'",
    )
