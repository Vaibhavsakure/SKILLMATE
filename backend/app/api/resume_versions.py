"""
Resume Versions API — CRUD for multi-version resume management.
"""

import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.resume_version import ResumeVersion
from app.models.resume import Resume

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Models ---
class VersionCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    raw_text: str = Field(..., min_length=10)
    is_enhanced: bool = False
    enhancement_note: Optional[str] = None


class VersionUpdate(BaseModel):
    label: Optional[str] = None
    raw_text: Optional[str] = None


class VersionResponse(BaseModel):
    id: str
    label: str
    raw_text: Optional[str]
    is_enhanced: bool
    enhancement_note: Optional[str]
    version_number: int
    created_at: str


class VersionListResponse(BaseModel):
    versions: List[VersionResponse]
    total: int


def _get_or_create_resume(db: Session, user_id: str) -> Resume:
    """Get or create a base resume container for the user."""
    resume = db.query(Resume).filter(Resume.user_id == user_id).first()
    if not resume:
        resume = Resume(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title="My Resume",
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)
    return resume


# --- Endpoints ---

@router.get("/versions", response_model=VersionListResponse)
async def list_versions(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all resume versions for the user."""
    user_id = user.get("id")
    resume = _get_or_create_resume(db, user_id)

    versions = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.resume_id == resume.id)
        .order_by(ResumeVersion.version_number.desc())
        .all()
    )

    items = [
        VersionResponse(
            id=v.id,
            label=v.enhancement_note or f"Version {v.version_number}",
            raw_text=v.raw_text,
            is_enhanced=v.is_enhanced,
            enhancement_note=v.enhancement_note,
            version_number=v.version_number,
            created_at=str(v.created_at) if v.created_at else "",
        )
        for v in versions
    ]

    return VersionListResponse(versions=items, total=len(items))


@router.post("/versions", response_model=VersionResponse)
async def create_version(
    data: VersionCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a new resume version."""
    user_id = user.get("id")
    resume = _get_or_create_resume(db, user_id)

    # Get next version number
    max_ver = (
        db.query(ResumeVersion.version_number)
        .filter(ResumeVersion.resume_id == resume.id)
        .order_by(ResumeVersion.version_number.desc())
        .first()
    )
    next_ver = (max_ver[0] + 1) if max_ver else 1

    version = ResumeVersion(
        id=str(uuid.uuid4()),
        resume_id=resume.id,
        raw_text=data.raw_text,
        is_enhanced=data.is_enhanced,
        enhancement_note=data.label,
        version_number=next_ver,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    logger.info(f"Resume version {next_ver} created for user {user_id}")

    return VersionResponse(
        id=version.id,
        label=data.label,
        raw_text=version.raw_text,
        is_enhanced=version.is_enhanced,
        enhancement_note=version.enhancement_note,
        version_number=version.version_number,
        created_at=str(version.created_at) if version.created_at else "",
    )


@router.put("/versions/{version_id}", response_model=VersionResponse)
async def update_version(
    version_id: str,
    data: VersionUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a resume version's label or text."""
    user_id = user.get("id")
    resume = _get_or_create_resume(db, user_id)

    version = db.query(ResumeVersion).filter(
        ResumeVersion.id == version_id,
        ResumeVersion.resume_id == resume.id,
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if data.label is not None:
        version.enhancement_note = data.label
    if data.raw_text is not None:
        version.raw_text = data.raw_text

    db.commit()
    db.refresh(version)

    return VersionResponse(
        id=version.id,
        label=version.enhancement_note or f"Version {version.version_number}",
        raw_text=version.raw_text,
        is_enhanced=version.is_enhanced,
        enhancement_note=version.enhancement_note,
        version_number=version.version_number,
        created_at=str(version.created_at) if version.created_at else "",
    )


@router.delete("/versions/{version_id}")
async def delete_version(
    version_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a resume version."""
    user_id = user.get("id")
    resume = _get_or_create_resume(db, user_id)

    version = db.query(ResumeVersion).filter(
        ResumeVersion.id == version_id,
        ResumeVersion.resume_id == resume.id,
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    db.delete(version)
    db.commit()

    return {"status": "deleted", "id": version_id}


@router.post("/versions/{version_id}/clone", response_model=VersionResponse)
async def clone_version(
    version_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clone an existing version with a new label."""
    user_id = user.get("id")
    resume = _get_or_create_resume(db, user_id)

    source = db.query(ResumeVersion).filter(
        ResumeVersion.id == version_id,
        ResumeVersion.resume_id == resume.id,
    ).first()

    if not source:
        raise HTTPException(status_code=404, detail="Source version not found")

    max_ver = (
        db.query(ResumeVersion.version_number)
        .filter(ResumeVersion.resume_id == resume.id)
        .order_by(ResumeVersion.version_number.desc())
        .first()
    )
    next_ver = (max_ver[0] + 1) if max_ver else 1

    clone = ResumeVersion(
        id=str(uuid.uuid4()),
        resume_id=resume.id,
        raw_text=source.raw_text,
        content_json=source.content_json,
        is_enhanced=source.is_enhanced,
        enhancement_note=f"Copy of {source.enhancement_note or 'Version ' + str(source.version_number)}",
        version_number=next_ver,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)

    return VersionResponse(
        id=clone.id,
        label=clone.enhancement_note or f"Version {clone.version_number}",
        raw_text=clone.raw_text,
        is_enhanced=clone.is_enhanced,
        enhancement_note=clone.enhancement_note,
        version_number=clone.version_number,
        created_at=str(clone.created_at) if clone.created_at else "",
    )
