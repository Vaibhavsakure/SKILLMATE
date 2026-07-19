"""
Job Board API — Job Seeker Endpoints
======================================
GET  /board              — List active job openings (public)
GET  /board/{job_id}     — Get single job detail
POST /apply/{job_id}     — Apply using saved resume from context
GET  /my-applications    — List user's own applications
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.ats_engine import ats_score_engine
from app.models.recruiter_models import RecruiterJob, Candidate
from app.models.user_context import UserContext

logger = logging.getLogger(__name__)

router = APIRouter()


# ===========================================================================
#  Pydantic Schemas
# ===========================================================================

class JobBoardItem(BaseModel):
    id: str
    title: str
    company_name: Optional[str]
    experience_level: Optional[str]
    required_skills: Optional[str]
    jd_preview: str  # First 300 chars of JD
    created_at: str
    is_active: bool


class JobBoardDetailItem(BaseModel):
    id: str
    title: str
    company_name: Optional[str]
    experience_level: Optional[str]
    required_skills: Optional[str]
    jd_text: str
    created_at: str
    is_active: bool
    match_score: Optional[int] = None  # Populated if user has a resume


class ApplicationOut(BaseModel):
    id: int
    job_id: str
    job_title: str
    company_name: Optional[str]
    overall_score: int
    recommendation: str
    status: str
    applied_at: str


class ApplyResponse(BaseModel):
    candidate_id: int
    job_title: str
    match_score: int
    status: str
    message: str


# ===========================================================================
#  Endpoints
# ===========================================================================

@router.get("/board", response_model=List[JobBoardItem])
async def list_job_board(
    search: Optional[str] = Query(None, description="Search in title or company"),
    experience: Optional[str] = Query(None, description="Filter by experience level"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    List all active job openings. Public endpoint — no auth required
    for browsing, but auth needed for applying.
    """
    query = db.query(RecruiterJob).filter(RecruiterJob.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (RecruiterJob.title.ilike(search_term)) |
            (RecruiterJob.company_name.ilike(search_term))
        )

    if experience:
        query = query.filter(RecruiterJob.experience_level == experience)

    jobs = query.order_by(RecruiterJob.created_at.desc()).offset(offset).limit(limit).all()

    return [
        JobBoardItem(
            id=j.id,
            title=j.title,
            company_name=j.company_name,
            experience_level=j.experience_level,
            required_skills=j.required_skills,
            jd_preview=j.jd_text[:300] + ("..." if len(j.jd_text) > 300 else ""),
            created_at=j.created_at.isoformat() if j.created_at else "",
            is_active=j.is_active,
        )
        for j in jobs
    ]


@router.get("/board/{job_id}", response_model=JobBoardDetailItem)
async def get_job_detail(
    job_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full job detail with optional match score based on user's resume."""
    job = db.query(RecruiterJob).filter(
        RecruiterJob.id == job_id,
        RecruiterJob.is_active == True,
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found or no longer active")

    # Calculate match score if user has a resume in context
    match_score = None
    try:
        ctx = db.query(UserContext).filter(
            UserContext.user_id == user["id"]
        ).first()

        if ctx and ctx.resume_text and len(ctx.resume_text.strip()) > 50:
            ats_result = ats_score_engine(ctx.resume_text, job.jd_text)
            match_score = ats_result.get("ats_score", None)
    except Exception as e:
        logger.warning(f"Match score calculation failed: {e}")

    return JobBoardDetailItem(
        id=job.id,
        title=job.title,
        company_name=job.company_name,
        experience_level=job.experience_level,
        required_skills=job.required_skills,
        jd_text=job.jd_text,
        created_at=job.created_at.isoformat() if job.created_at else "",
        is_active=job.is_active,
        match_score=match_score,
    )


@router.post("/apply/{job_id}", response_model=ApplyResponse)
async def apply_to_job(
    job_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Apply to a job using the user's saved resume from context.
    One-click application — no file upload needed.
    """
    # 1. Check job exists and is active
    job = db.query(RecruiterJob).filter(
        RecruiterJob.id == job_id,
        RecruiterJob.is_active == True,
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found or no longer active")

    # 2. Check for duplicate application
    existing = db.query(Candidate).filter(
        Candidate.job_id == job_id,
        Candidate.applicant_user_id == user["id"],
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You have already applied to this job",
        )

    # 3. Get user's resume from context
    ctx = db.query(UserContext).filter(
        UserContext.user_id == user["id"]
    ).first()

    if not ctx or not ctx.resume_text or len(ctx.resume_text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="No resume found in your profile. Please upload a resume first.",
        )

    resume_text = ctx.resume_text

    # 4. Calculate match score using ATS engine
    ats_result = ats_score_engine(resume_text, job.jd_text)
    match_score = ats_result.get("ats_score", 0)

    # 5. Create candidate record
    candidate = Candidate(
        job_id=job.id,
        applicant_user_id=user["id"],
        applicant_name=user.get("user_metadata", {}).get("full_name", user.get("email", "").split("@")[0]),
        applicant_email=user.get("email", ""),
        cv_text=resume_text,
        cv_filename="skillmate_profile_resume",
        overall_score=match_score,
        skills_match=ats_result.get("section_scores", {}).get("Technical Skills", 0),
        experience_fit=ats_result.get("section_scores", {}).get("Context", 0),
        red_flags=json.dumps(ats_result.get("critical_missing", [])[:5]),
        green_flags=json.dumps(ats_result.get("matched_keywords", [])[:5]),
        summary=f"Applied via Skillmate Job Board. ATS keyword match: {match_score}%.",
        recommendation="yes" if match_score >= 65 else ("maybe" if match_score >= 45 else "no"),
        status="pending",
        source="applied",
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    logger.info(f"📨 User {user['id']} applied to job {job.title} (score={match_score})")

    return ApplyResponse(
        candidate_id=candidate.id,
        job_title=job.title,
        match_score=match_score,
        status="pending",
        message=f"Application submitted! Your match score is {match_score}%.",
    )


@router.get("/my-applications", response_model=List[ApplicationOut])
async def my_applications(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all jobs the current user has applied to."""
    candidates = db.query(Candidate).filter(
        Candidate.applicant_user_id == user["id"],
    ).order_by(Candidate.applied_at.desc()).all()

    results = []
    for c in candidates:
        job = db.query(RecruiterJob).filter(RecruiterJob.id == c.job_id).first()
        results.append(ApplicationOut(
            id=c.id,
            job_id=c.job_id,
            job_title=job.title if job else "Unknown",
            company_name=job.company_name if job else None,
            overall_score=c.overall_score or 0,
            recommendation=c.recommendation or "pending",
            status=c.status,
            applied_at=c.applied_at.isoformat() if c.applied_at else "",
        ))

    return results
