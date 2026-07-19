"""
Recruiter Portal API — HR / Recruiter Endpoints
=================================================
POST /jobs            — Create a new job opening
POST /screen          — Upload CV(s), parse, score, store candidates
GET  /shortlist/{id}  — Get ranked candidate list for a job
POST /action          — Approve or reject a candidate
GET  /dashboard       — Recruiter analytics overview
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.ai_service import ai_service
from app.services.ats_engine import ats_score_engine
from app.utils.file_parser import extract_text_from_file
from app.models.recruiter_models import RecruiterJob, Candidate

logger = logging.getLogger(__name__)

router = APIRouter()


# ===========================================================================
#  Pydantic Schemas
# ===========================================================================

class CreateJobRequest(BaseModel):
    title: str
    company_name: Optional[str] = None
    jd_text: str
    required_skills: Optional[str] = None
    experience_level: Optional[str] = "mid"
    score_threshold: int = 60
    calendly_link: Optional[str] = None


class CreateJobResponse(BaseModel):
    id: str
    title: str
    is_active: bool
    message: str


class CandidateOut(BaseModel):
    id: int
    applicant_name: Optional[str]
    applicant_email: Optional[str]
    cv_filename: Optional[str]
    overall_score: int
    skills_match: int
    experience_fit: int
    red_flags: List[str]
    green_flags: List[str]
    summary: Optional[str]
    recommendation: str
    status: str
    source: str


class ScreenResponse(BaseModel):
    job_id: str
    candidates_screened: int
    candidates: List[CandidateOut]


class ActionRequest(BaseModel):
    candidate_id: int
    action: str  # "approve" or "reject"
    custom_message: Optional[str] = None


class ActionResponse(BaseModel):
    candidate_id: int
    new_status: str
    email_sent: bool
    message: str


class JobSummary(BaseModel):
    id: str
    title: str
    company_name: Optional[str]
    is_active: bool
    candidate_count: int
    shortlisted: int
    avg_score: float
    created_at: str


class RecruiterDashboardResponse(BaseModel):
    active_jobs: int
    total_jobs: int
    total_candidates: int
    shortlisted: int
    rejected: int
    shortlist_rate: float
    estimated_hours_saved: float
    jobs: List[JobSummary]


# ===========================================================================
#  Helpers
# ===========================================================================

def _require_recruiter(user: dict):
    """Raises 403 if user is not a recruiter."""
    role = user.get("role", "")
    metadata = user.get("user_metadata", {}) or {}
    meta_role = metadata.get("role", "")
    if role != "recruiter" and meta_role != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter access required. Your role must be 'recruiter'.",
        )


def _parse_json_list(raw: Optional[str]) -> List[str]:
    """Safely parse a JSON-encoded list string, or return empty list."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _candidate_to_out(c: Candidate) -> CandidateOut:
    """Convert ORM Candidate to Pydantic response."""
    return CandidateOut(
        id=c.id,
        applicant_name=c.applicant_name,
        applicant_email=c.applicant_email,
        cv_filename=c.cv_filename,
        overall_score=c.overall_score or 0,
        skills_match=c.skills_match or 0,
        experience_fit=c.experience_fit or 0,
        red_flags=_parse_json_list(c.red_flags),
        green_flags=_parse_json_list(c.green_flags),
        summary=c.summary,
        recommendation=c.recommendation or "pending",
        status=c.status,
        source=c.source,
    )


# --- Email Stub ---
async def _send_email(to: str, subject: str, body: str):
    """
    Stub for email delivery. Replace with Resend/SendGrid/SES later.
    Logs the email content for now.
    """
    logger.info(f"📧 EMAIL → {to}")
    logger.info(f"   Subject: {subject}")
    logger.info(f"   Body: {body[:200]}...")
    # TODO: Integrate actual email provider
    # import resend
    # resend.api_key = settings.resend_api_key
    # resend.Emails.send({"from": "...", "to": to, "subject": subject, "html": body})
    return True


# --- AI Scoring Prompt ---
CANDIDATE_SCORING_PROMPT = """Score this candidate vs the job. Be concise. Return JSON only (no markdown).
JOB: {title} · Level: {experience_level} · Required skills: {required_skills}
JD: {jd_text}
RESUME: {cv_text}
{{
  "overall_score":<0-100>,"skills_match":<0-100>,"experience_fit":<0-100>,
  "red_flags":["gaps/mismatches/overqualified/underqualified/inconsistencies"],
  "green_flags":["exact matches/certs/leadership/projects/culture fit"],
  "summary":"<1-paragraph fit assessment>",
  "recommendation":"<strong_yes|yes|maybe|no>",
  "applicant_name":"<full name or Unknown>","applicant_email":"<email or empty string>"
}}
· 80-100=strong_yes · 65-79=yes · 45-64=maybe · 0-44=no
"""


# ===========================================================================
#  Endpoints
# ===========================================================================

@router.post("/jobs", response_model=CreateJobResponse)
async def create_job(
    data: CreateJobRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new job opening (recruiter only)."""
    _require_recruiter(user)

    job = RecruiterJob(
        hr_user_id=user["id"],
        title=data.title,
        company_name=data.company_name,
        jd_text=data.jd_text,
        required_skills=data.required_skills,
        experience_level=data.experience_level,
        score_threshold=data.score_threshold,
        calendly_link=data.calendly_link,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    logger.info(f"📋 Job created: '{job.title}' by {user['id']}")

    return CreateJobResponse(
        id=job.id,
        title=job.title,
        is_active=job.is_active,
        message="Job created successfully",
    )


@router.post("/screen", response_model=ScreenResponse)
async def screen_candidates(
    job_id: str = Form(...),
    resume_files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bulk-upload CVs for a job. Each CV is:
    1. Parsed (file_parser)
    2. Keyword-scored (ats_engine)
    3. AI-analyzed (ai_service)
    4. Stored as a Candidate row
    """
    _require_recruiter(user)

    # Verify job exists and belongs to this recruiter
    job = db.query(RecruiterJob).filter(
        RecruiterJob.id == job_id,
        RecruiterJob.hr_user_id == user["id"],
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")

    results: List[CandidateOut] = []

    for file in resume_files:
        try:
            # 1. Extract text from CV
            content = await file.read()
            cv_text = extract_text_from_file(content, file.filename)

            if not cv_text or len(cv_text.strip()) < 50:
                logger.warning(f"Skipping {file.filename}: insufficient text extracted")
                continue

            # 2. Keyword-based ATS scoring (fast, local)
            ats_result = ats_score_engine(cv_text, job.jd_text)
            keyword_score = ats_result.get("ats_score", 0)

            # 3. Deep AI analysis
            prompt = CANDIDATE_SCORING_PROMPT.format(
                title=job.title,
                jd_text=job.jd_text[:3000],
                required_skills=job.required_skills or "Not specified",
                experience_level=job.experience_level or "mid",
                cv_text=cv_text[:4000],
            )

            try:
                ai_data = await ai_service.generate_json(prompt)
            except Exception as e:
                logger.error(f"AI scoring failed for {file.filename}: {e}")
                # Fallback to keyword-only scoring
                ai_data = {
                    "overall_score": keyword_score,
                    "skills_match": keyword_score,
                    "experience_fit": 50,
                    "red_flags": [],
                    "green_flags": [],
                    "summary": "AI analysis unavailable. Score based on keyword matching only.",
                    "recommendation": "maybe" if keyword_score >= 50 else "no",
                    "applicant_name": "Unknown",
                    "applicant_email": "",
                }

            # Blend keyword score with AI score (30% keyword + 70% AI)
            ai_overall = ai_data.get("overall_score", 0)
            blended_score = int(0.3 * keyword_score + 0.7 * ai_overall)

            # Determine recommendation based on blended score
            if blended_score >= 80:
                final_rec = "strong_yes"
            elif blended_score >= 65:
                final_rec = "yes"
            elif blended_score >= 45:
                final_rec = "maybe"
            else:
                final_rec = "no"

            # 4. Store candidate
            candidate = Candidate(
                job_id=job.id,
                applicant_name=ai_data.get("applicant_name", "Unknown"),
                applicant_email=ai_data.get("applicant_email", ""),
                cv_text=cv_text,
                cv_filename=file.filename,
                overall_score=blended_score,
                skills_match=ai_data.get("skills_match", 0),
                experience_fit=ai_data.get("experience_fit", 0),
                red_flags=json.dumps(ai_data.get("red_flags", [])),
                green_flags=json.dumps(ai_data.get("green_flags", [])),
                summary=ai_data.get("summary", ""),
                recommendation=final_rec,
                status="pending",
                source="upload",
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)

            results.append(_candidate_to_out(candidate))

            logger.info(
                f"✅ Screened {file.filename}: score={blended_score}, rec={final_rec}"
            )

        except ValueError as ve:
            logger.warning(f"File parse error for {file.filename}: {ve}")
            continue
        except Exception as e:
            logger.error(f"Unexpected error screening {file.filename}: {e}")
            continue

    if not results:
        raise HTTPException(
            status_code=400,
            detail="No valid CVs could be processed. Check file formats (PDF, DOCX, TXT).",
        )

    return ScreenResponse(
        job_id=job_id,
        candidates_screened=len(results),
        candidates=results,
    )


@router.get("/shortlist/{job_id}")
async def get_shortlist(
    job_id: str,
    status_filter: Optional[str] = None,
    recommendation_filter: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get ranked candidates for a job, sorted by score descending."""
    _require_recruiter(user)

    # Verify ownership
    job = db.query(RecruiterJob).filter(
        RecruiterJob.id == job_id,
        RecruiterJob.hr_user_id == user["id"],
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")

    query = db.query(Candidate).filter(Candidate.job_id == job_id)

    if status_filter:
        query = query.filter(Candidate.status == status_filter)
    if recommendation_filter:
        query = query.filter(Candidate.recommendation == recommendation_filter)

    candidates = query.order_by(Candidate.overall_score.desc()).all()

    return {
        "job_id": job.id,
        "job_title": job.title,
        "company_name": job.company_name,
        "score_threshold": job.score_threshold,
        "total_candidates": len(candidates),
        "candidates": [_candidate_to_out(c) for c in candidates],
    }


@router.post("/action", response_model=ActionResponse)
async def candidate_action(
    data: ActionRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve or reject a candidate. Triggers email notification."""
    _require_recruiter(user)

    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Verify recruiter owns this job
    job = db.query(RecruiterJob).filter(
        RecruiterJob.id == candidate.job_id,
        RecruiterJob.hr_user_id == user["id"],
    ).first()

    if not job:
        raise HTTPException(status_code=403, detail="Access denied to this candidate's job")

    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    # Update status
    new_status = "approved" if data.action == "approve" else "rejected"
    candidate.status = new_status
    db.commit()

    # Send email notification
    email_sent = False
    email_address = candidate.applicant_email
    candidate_name = candidate.applicant_name or "Candidate"

    if email_address:
        if data.action == "approve":
            calendly_part = ""
            if job.calendly_link:
                calendly_part = f"\n\nPlease schedule your interview at: {job.calendly_link}"

            custom_part = ""
            if data.custom_message:
                custom_part = f"\n\n{data.custom_message}"

            await _send_email(
                to=email_address,
                subject=f"🎉 You've been shortlisted for {job.title} at {job.company_name or 'our company'}!",
                body=(
                    f"Hi {candidate_name},\n\n"
                    f"Great news! We've reviewed your application for the {job.title} position "
                    f"and we'd love to move forward with you."
                    f"{calendly_part}{custom_part}\n\n"
                    f"Best regards,\n{job.company_name or 'The Hiring Team'}"
                ),
            )
            email_sent = True

        elif data.action == "reject":
            await _send_email(
                to=email_address,
                subject=f"Update on your application for {job.title}",
                body=(
                    f"Hi {candidate_name},\n\n"
                    f"Thank you for your interest in the {job.title} position "
                    f"at {job.company_name or 'our company'}. "
                    f"After careful review, we've decided to move forward with other candidates "
                    f"whose experience more closely matches our current needs.\n\n"
                    f"We truly appreciate the time you invested in applying and encourage you "
                    f"to apply for future openings that align with your skills.\n\n"
                    f"Wishing you all the best in your career journey!\n\n"
                    f"Best regards,\n{job.company_name or 'The Hiring Team'}"
                ),
            )
            email_sent = True

    logger.info(f"👤 Candidate {candidate.id} → {new_status} (email_sent={email_sent})")

    return ActionResponse(
        candidate_id=candidate.id,
        new_status=new_status,
        email_sent=email_sent,
        message=f"Candidate {new_status} successfully" + (
            ". Notification email sent." if email_sent else ". No email on file."
        ),
    )


@router.get("/dashboard", response_model=RecruiterDashboardResponse)
async def recruiter_dashboard(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns recruiter analytics: jobs, candidates, shortlist rate, time saved."""
    _require_recruiter(user)

    jobs = db.query(RecruiterJob).filter(
        RecruiterJob.hr_user_id == user["id"]
    ).order_by(RecruiterJob.created_at.desc()).all()

    job_summaries: List[JobSummary] = []
    total_candidates = 0
    total_shortlisted = 0
    total_rejected = 0

    for j in jobs:
        candidates = db.query(Candidate).filter(Candidate.job_id == j.id).all()
        count = len(candidates)
        shortlisted = sum(1 for c in candidates if c.status == "approved")
        avg = sum(c.overall_score or 0 for c in candidates) / count if count else 0.0

        total_candidates += count
        total_shortlisted += shortlisted
        total_rejected += sum(1 for c in candidates if c.status == "rejected")

        job_summaries.append(JobSummary(
            id=j.id,
            title=j.title,
            company_name=j.company_name,
            is_active=j.is_active,
            candidate_count=count,
            shortlisted=shortlisted,
            avg_score=round(avg, 1),
            created_at=j.created_at.isoformat() if j.created_at else "",
        ))

    active_count = sum(1 for j in jobs if j.is_active)
    shortlist_rate = (total_shortlisted / total_candidates * 100) if total_candidates else 0.0

    # Estimate: ~15 min per manual CV review → saved time
    estimated_hours = round(total_candidates * 15 / 60, 1)

    return RecruiterDashboardResponse(
        active_jobs=active_count,
        total_jobs=len(jobs),
        total_candidates=total_candidates,
        shortlisted=total_shortlisted,
        rejected=total_rejected,
        shortlist_rate=round(shortlist_rate, 1),
        estimated_hours_saved=estimated_hours,
        jobs=job_summaries,
    )
