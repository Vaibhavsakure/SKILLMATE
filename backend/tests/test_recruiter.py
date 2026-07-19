"""
Skillmate AI — Recruiter Portal Tests
=======================================
Tests for:
  - POST /api/v1/recruiter/jobs      — Create job (recruiter only)
  - POST /api/v1/recruiter/screen    — Bulk CV screening with AI
  - GET  /api/v1/recruiter/shortlist — Ranked candidate list
  - POST /api/v1/recruiter/action    — Approve/reject candidate
  - GET  /api/v1/recruiter/dashboard — Analytics overview
  - Role guards                      — Students blocked with 403
"""

import io
import json
import pytest
from unittest.mock import patch, AsyncMock

from tests.conftest import (
    MOCK_RECRUITER_USER,
    MOCK_STUDENT_USER,
    seed_recruiter_job,
)
from app.models.recruiter_models import RecruiterJob, Candidate

pytestmark = pytest.mark.asyncio


# ── Fixed AI response for CV screening ──────────────────────
MOCK_CV_SCORING_RESPONSE = {
    "overall_score": 82,
    "skills_match": 90,
    "experience_fit": 75,
    "red_flags": ["No cloud certifications listed"],
    "green_flags": ["5+ years Python", "FastAPI expertise", "Leadership experience"],
    "summary": "Strong candidate with excellent Python skills and relevant API experience.",
    "recommendation": "strong_yes",
    "applicant_name": "Jane Doe",
    "applicant_email": "jane.doe@example.com",
}


# ============================================================
#  Job Creation Tests
# ============================================================

class TestCreateJob:
    """Tests for POST /api/v1/recruiter/jobs."""

    async def test_create_job_as_recruiter(self, recruiter_client):
        """Should successfully create a job posting when the user is a recruiter."""
        response = await recruiter_client.post(
            "/api/v1/recruiter/jobs",
            json={
                "title": "Backend Engineer",
                "company_name": "Acme Corp",
                "jd_text": "Build REST APIs with Python and FastAPI. AWS experience required.",
                "required_skills": "Python, FastAPI, AWS",
                "experience_level": "mid",
                "score_threshold": 70,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Backend Engineer"
        assert data["is_active"] is True
        assert data["message"] == "Job created successfully"
        assert "id" in data

    async def test_create_job_as_student_blocked(self, student_client):
        """Should return 403 when a student tries to create a job."""
        response = await student_client.post(
            "/api/v1/recruiter/jobs",
            json={
                "title": "Data Analyst",
                "jd_text": "Analyze data using SQL and Python.",
            },
        )

        assert response.status_code == 403
        assert "recruiter" in response.json()["detail"].lower()

    async def test_create_job_unauthenticated(self, unauthenticated_client):
        """Should return 401 when no auth token is provided."""
        response = await unauthenticated_client.post(
            "/api/v1/recruiter/jobs",
            json={
                "title": "Test Job",
                "jd_text": "Test JD",
            },
        )

        assert response.status_code == 401

    async def test_create_job_missing_title(self, recruiter_client):
        """Should return 422 when required fields are missing."""
        response = await recruiter_client.post(
            "/api/v1/recruiter/jobs",
            json={
                "jd_text": "Missing the title field entirely",
            },
        )

        assert response.status_code == 422


# ============================================================
#  CV Screening Tests
# ============================================================

class TestScreenCandidates:
    """Tests for POST /api/v1/recruiter/screen."""

    @patch("app.api.recruiter.ai_service.generate_json", new_callable=AsyncMock)
    @patch("app.api.recruiter.extract_text_from_file")
    @patch("app.api.recruiter.ats_score_engine")
    async def test_screen_single_cv(
        self, mock_ats_engine, mock_file_parser, mock_ai, recruiter_client, db
    ):
        """Should screen one CV and return a scored candidate."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])

        mock_file_parser.return_value = (
            "Jane Doe\njane.doe@example.com\n"
            "Senior Python Developer with 5 years of experience in FastAPI, "
            "PostgreSQL, and AWS. Led a team of 4 engineers."
        )
        mock_ats_engine.return_value = {
            "ats_score": 70,
            "matched_keywords": ["Python", "FastAPI", "AWS"],
        }
        mock_ai.return_value = MOCK_CV_SCORING_RESPONSE

        # Create a minimal PDF-like file for upload
        fake_pdf = io.BytesIO(b"%PDF-fake-content-for-testing" * 10)

        response = await recruiter_client.post(
            "/api/v1/recruiter/screen",
            data={"job_id": job.id},
            files={"resume_files": ("jane_doe_resume.pdf", fake_pdf, "application/pdf")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["candidates_screened"] == 1
        assert data["job_id"] == job.id

        candidate = data["candidates"][0]
        assert candidate["applicant_name"] == "Jane Doe"
        assert candidate["applicant_email"] == "jane.doe@example.com"
        assert candidate["status"] == "pending"
        assert 0 <= candidate["overall_score"] <= 100

    async def test_screen_student_blocked(self, student_client, db):
        """Should return 403 when a student tries to screen CVs."""
        fake_pdf = io.BytesIO(b"%PDF-fake")

        response = await student_client.post(
            "/api/v1/recruiter/screen",
            data={"job_id": "some-fake-job-id"},
            files={"resume_files": ("test.pdf", fake_pdf, "application/pdf")},
        )

        assert response.status_code == 403

    @patch("app.api.recruiter.extract_text_from_file")
    async def test_screen_job_not_found(self, mock_parser, recruiter_client, db):
        """Should return 404 when the job ID doesn't exist."""
        mock_parser.return_value = "Some resume text here for testing purposes only"
        fake_pdf = io.BytesIO(b"%PDF-fake-content-for-testing" * 10)

        response = await recruiter_client.post(
            "/api/v1/recruiter/screen",
            data={"job_id": "nonexistent-job-id"},
            files={"resume_files": ("test.pdf", fake_pdf, "application/pdf")},
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


# ============================================================
#  Shortlist Tests
# ============================================================

class TestShortlist:
    """Tests for GET /api/v1/recruiter/shortlist/{job_id}."""

    async def test_get_shortlist_empty(self, recruiter_client, db):
        """Should return an empty candidate list for a new job."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])

        response = await recruiter_client.get(f"/api/v1/recruiter/shortlist/{job.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total_candidates"] == 0
        assert data["candidates"] == []
        assert data["job_title"] == job.title

    async def test_get_shortlist_with_candidates(self, recruiter_client, db):
        """Should return candidates sorted by score descending."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])

        # Seed two candidates with different scores
        for name, score in [("Alice", 90), ("Bob", 60)]:
            candidate = Candidate(
                job_id=job.id,
                applicant_name=name,
                cv_text=f"Resume of {name}",
                overall_score=score,
                skills_match=score,
                experience_fit=score,
                recommendation="yes" if score >= 65 else "maybe",
                status="pending",
                source="upload",
            )
            db.add(candidate)
        db.commit()

        response = await recruiter_client.get(f"/api/v1/recruiter/shortlist/{job.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total_candidates"] == 2
        # Alice (90) should be first
        assert data["candidates"][0]["applicant_name"] == "Alice"
        assert data["candidates"][1]["applicant_name"] == "Bob"

    async def test_shortlist_wrong_owner(self, recruiter_client, db):
        """Should return 404 when a recruiter tries to access another recruiter's job."""
        # Create a job owned by a different recruiter
        job = seed_recruiter_job(db, "other-recruiter-id-999")

        response = await recruiter_client.get(f"/api/v1/recruiter/shortlist/{job.id}")

        assert response.status_code == 404

    async def test_shortlist_student_blocked(self, student_client, db):
        """Should return 403 when a student tries to access shortlist."""
        response = await student_client.get("/api/v1/recruiter/shortlist/any-id")
        assert response.status_code == 403


# ============================================================
#  Candidate Action Tests
# ============================================================

class TestCandidateAction:
    """Tests for POST /api/v1/recruiter/action."""

    async def test_approve_candidate(self, recruiter_client, db):
        """Should update candidate status to 'approved' and attempt email."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])
        candidate = Candidate(
            job_id=job.id,
            applicant_name="John Smith",
            applicant_email="john@example.com",
            cv_text="Full resume text here",
            overall_score=85,
            recommendation="strong_yes",
            status="pending",
            source="upload",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        response = await recruiter_client.post(
            "/api/v1/recruiter/action",
            json={
                "candidate_id": candidate.id,
                "action": "approve",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["new_status"] == "approved"
        assert data["email_sent"] is True
        assert "successfully" in data["message"]

    async def test_reject_candidate(self, recruiter_client, db):
        """Should update candidate status to 'rejected'."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])
        candidate = Candidate(
            job_id=job.id,
            applicant_name="Rejected Candidate",
            applicant_email="reject@example.com",
            cv_text="Resume text",
            overall_score=30,
            recommendation="no",
            status="pending",
            source="upload",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        response = await recruiter_client.post(
            "/api/v1/recruiter/action",
            json={
                "candidate_id": candidate.id,
                "action": "reject",
            },
        )

        assert response.status_code == 200
        assert response.json()["new_status"] == "rejected"

    async def test_invalid_action_returns_400(self, recruiter_client, db):
        """Should return 400 when action is neither 'approve' nor 'reject'."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])
        candidate = Candidate(
            job_id=job.id,
            applicant_name="Test",
            cv_text="Text",
            status="pending",
            source="upload",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        response = await recruiter_client.post(
            "/api/v1/recruiter/action",
            json={
                "candidate_id": candidate.id,
                "action": "maybe",  # invalid
            },
        )

        assert response.status_code == 400
        assert "approve" in response.json()["detail"].lower()

    async def test_action_candidate_not_found(self, recruiter_client):
        """Should return 404 when candidate ID doesn't exist."""
        response = await recruiter_client.post(
            "/api/v1/recruiter/action",
            json={
                "candidate_id": 99999,
                "action": "approve",
            },
        )

        assert response.status_code == 404


# ============================================================
#  Dashboard Tests
# ============================================================

class TestRecruiterDashboard:
    """Tests for GET /api/v1/recruiter/dashboard."""

    async def test_dashboard_empty(self, recruiter_client):
        """Should return zero-value analytics when no jobs exist."""
        response = await recruiter_client.get("/api/v1/recruiter/dashboard")

        assert response.status_code == 200
        data = response.json()
        assert data["total_jobs"] == 0
        assert data["total_candidates"] == 0
        assert data["shortlist_rate"] == 0.0
        assert data["estimated_hours_saved"] == 0.0

    async def test_dashboard_with_data(self, recruiter_client, db):
        """Should compute correct analytics from seeded data."""
        job = seed_recruiter_job(db, MOCK_RECRUITER_USER["id"])

        # Add 2 candidates
        for name, status in [("Alice", "approved"), ("Bob", "rejected")]:
            db.add(Candidate(
                job_id=job.id,
                applicant_name=name,
                cv_text=f"Resume of {name}",
                overall_score=75,
                status=status,
                source="upload",
            ))
        db.commit()

        response = await recruiter_client.get("/api/v1/recruiter/dashboard")

        assert response.status_code == 200
        data = response.json()
        assert data["total_jobs"] == 1
        assert data["active_jobs"] == 1
        assert data["total_candidates"] == 2
        assert data["shortlisted"] == 1
        assert data["rejected"] == 1
        assert data["shortlist_rate"] == 50.0
        # 2 candidates × 15 min / 60 = 0.5 hours
        assert data["estimated_hours_saved"] == 0.5

    async def test_dashboard_student_blocked(self, student_client):
        """Should return 403 when a student accesses the recruiter dashboard."""
        response = await student_client.get("/api/v1/recruiter/dashboard")
        assert response.status_code == 403
