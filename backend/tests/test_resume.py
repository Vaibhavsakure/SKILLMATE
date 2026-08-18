"""
Skillmate AI — Resume Rewrite & Versioning Tests
===================================================
Tests for:
  - POST /api/v1/resume/rewrite        — AI resume rewrite (non-streaming)
  - POST /api/v1/resume/rewrite-stream  — Streaming resume rewrite
  - GET  /api/v1/resume/versions        — List resume versions
  - POST /api/v1/resume/versions        — Save a new resume version
  - PUT  /api/v1/resume/versions/{id}   — Update a version
  - DELETE /api/v1/resume/versions/{id} — Delete a version
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from tests.conftest import MOCK_STUDENT_USER

pytestmark = pytest.mark.asyncio


SAMPLE_JD = (
    "Looking for a Full-Stack Engineer with React, Node.js, and PostgreSQL. "
    "Must have 3+ years of experience building scalable web applications."
)

SAMPLE_RESUME = (
    "John Doe — Software Engineer\n"
    "3 years experience building web apps with React and Node.js.\n"
    "Proficient in PostgreSQL, REST APIs, and CI/CD pipelines.\n"
    "Led migration of monolith to microservices architecture."
)


def rewrite_payload(response):
    """
    Return the rewrite payload from the SuccessResponse envelope.

    /resume/rewrite declares response_model=SuccessResponse[RewriteResponse],
    so the body is {success, data, message, credits_used, request_id}. The
    /versions endpoints below return their models flat, hence no helper there.
    """
    body = response.json()
    assert body["success"] is True
    return body["data"]

MOCK_REWRITTEN_TEXT = (
    "John Doe — Full-Stack Engineer\n\n"
    "Results-driven engineer with 3+ years architecting scalable web applications "
    "using React, Node.js, and PostgreSQL. Spearheaded monolith-to-microservices "
    "migration, reducing deployment time by 60%. Expertise in REST API design, "
    "CI/CD automation, and agile development methodologies."
)


# ============================================================
#  Resume Rewrite Tests (Non-Streaming)
# ============================================================

class TestResumeRewrite:
    """Tests for POST /api/v1/resume/rewrite."""

    @patch("app.api.resume_rewrite.compute_score_comparison")
    @patch("app.api.resume_rewrite.ai_service.generate_text", new_callable=AsyncMock)
    async def test_rewrite_with_text_input(self, mock_ai, mock_score, student_client):
        """Should return rewritten content when resume text and JD are provided."""
        mock_ai.return_value = MOCK_REWRITTEN_TEXT
        mock_score.return_value = {
            "score_before": 55,
            "score_after": 82,
            "improvement": 27,
            "keywords_added": ["scalable", "microservices"],
            "keywords_before": 4,
            "keywords_after": 6,
            "section_scores_before": {},
            "section_scores_after": {},
        }

        response = await student_client.post(
            "/api/v1/resume/rewrite",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME,
                "tone": "Professional",
            },
        )

        assert response.status_code == 200
        data = rewrite_payload(response)
        assert data["status"] == "success"
        assert "Full-Stack Engineer" in data["rewritten_content"]
        assert data["score_comparison"] is not None
        assert data["score_comparison"]["improvement"] == 27
        mock_ai.assert_awaited_once()

    @patch("app.api.resume_rewrite.compute_score_comparison")
    @patch("app.api.resume_rewrite.ai_service.generate_text", new_callable=AsyncMock)
    async def test_rewrite_with_custom_tone(self, mock_ai, mock_score, student_client):
        """Should pass the tone parameter through to the AI prompt."""
        mock_ai.return_value = "Rewritten with executive tone"
        mock_score.return_value = None  # Score comparison can fail gracefully

        response = await student_client.post(
            "/api/v1/resume/rewrite",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME,
                "tone": "Executive",
                "custom_instructions": "Use strong action verbs",
            },
        )

        assert response.status_code == 200
        data = rewrite_payload(response)
        assert data["status"] == "success"
        # When score_comparison returns None, it should be null in JSON
        assert data["score_comparison"] is None

    async def test_rewrite_missing_resume_returns_400(self, student_client):
        """Should return 400 when no resume content is provided."""
        response = await student_client.post(
            "/api/v1/resume/rewrite",
            data={
                "job_description": SAMPLE_JD,
            },
        )

        assert response.status_code == 400
        assert "No resume content" in response.json()["detail"]

    async def test_rewrite_empty_resume_returns_400(self, student_client):
        """Should return 400 when resume_text is empty."""
        response = await student_client.post(
            "/api/v1/resume/rewrite",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": "",
            },
        )

        assert response.status_code == 400

    @patch("app.api.resume_rewrite.ai_service.generate_text", new_callable=AsyncMock)
    async def test_rewrite_ai_failure_returns_500(self, mock_ai, student_client):
        """Should return 500 when the AI service throws an exception."""
        mock_ai.side_effect = RuntimeError("Claude API rate limited")

        response = await student_client.post(
            "/api/v1/resume/rewrite",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME,
            },
        )

        assert response.status_code == 500
        assert "Failed to rewrite resume" in response.json()["detail"]

    async def test_rewrite_unauthenticated(self, unauthenticated_client):
        """Should return 401 when no auth token is provided."""
        response = await unauthenticated_client.post(
            "/api/v1/resume/rewrite",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME,
            },
        )

        assert response.status_code == 401


# ============================================================
#  Resume Rewrite Streaming Tests
# ============================================================

class TestResumeRewriteStream:
    """Tests for POST /api/v1/resume/rewrite-stream."""

    @patch("app.api.resume_rewrite._claude_client", None)
    @patch("app.api.resume_rewrite.compute_score_comparison")
    @patch("app.api.resume_rewrite.ai_service.generate_text", new_callable=AsyncMock)
    async def test_stream_fallback_when_no_claude(
        self, mock_ai, mock_score, student_client
    ):
        """Should fall back to non-streaming when Claude client is not configured."""
        mock_ai.return_value = MOCK_REWRITTEN_TEXT
        mock_score.return_value = {
            "score_before": 50,
            "score_after": 80,
            "improvement": 30,
            "keywords_added": ["scalable"],
            "keywords_before": 3,
            "keywords_after": 5,
            "section_scores_before": {},
            "section_scores_after": {},
        }

        response = await student_client.post(
            "/api/v1/resume/rewrite-stream",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME,
                "tone": "Professional",
            },
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")

        # The fallback yields the full text + score data
        body = response.text
        assert "Full-Stack Engineer" in body
        assert "SCORE_DATA" in body

    async def test_stream_missing_resume_returns_400(self, student_client):
        """Should return 400 when no resume content is provided for streaming."""
        response = await student_client.post(
            "/api/v1/resume/rewrite-stream",
            data={
                "job_description": SAMPLE_JD,
            },
        )

        assert response.status_code == 400

    async def test_stream_unauthenticated(self, unauthenticated_client):
        """Should return 401 when no auth token is provided."""
        response = await unauthenticated_client.post(
            "/api/v1/resume/rewrite-stream",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME,
            },
        )

        assert response.status_code == 401


# ============================================================
#  Resume Versioning Tests
# ============================================================

class TestResumeVersions:
    """Tests for the /api/v1/resume/versions CRUD endpoints."""

    async def test_list_versions_initially_empty(self, student_client):
        """Should return an empty version list for a new user."""
        response = await student_client.get("/api/v1/resume/versions")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["versions"] == []

    async def test_create_version(self, student_client):
        """Should create a resume version and return it with version_number=1."""
        response = await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "Original Upload",
                "raw_text": SAMPLE_RESUME,
                "is_enhanced": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["label"] == "Original Upload"
        assert data["version_number"] == 1
        assert data["is_enhanced"] is False
        assert data["raw_text"] == SAMPLE_RESUME
        assert "id" in data

    async def test_create_multiple_versions_increment(self, student_client):
        """Should auto-increment version_number for each new version."""
        # Create version 1
        await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "Version One",
                "raw_text": "Resume content version one with enough characters.",
            },
        )

        # Create version 2
        response = await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "AI Rewritten",
                "raw_text": "Improved resume content after AI rewrite with metrics.",
                "is_enhanced": True,
                "enhancement_note": "Rewritten with Professional tone",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["version_number"] == 2
        assert data["is_enhanced"] is True

    async def test_create_version_too_short_returns_422(self, student_client):
        """Should return 422 when raw_text is less than 10 characters."""
        response = await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "Too Short",
                "raw_text": "Short",  # < 10 chars, violates Field(min_length=10)
            },
        )

        assert response.status_code == 422

    async def test_update_version(self, student_client):
        """Should update the label and raw_text of an existing version."""
        # Create a version first
        create_resp = await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "Draft Resume",
                "raw_text": "Original resume content that is long enough to be valid.",
            },
        )
        version_id = create_resp.json()["id"]

        # Update it
        response = await student_client.put(
            f"/api/v1/resume/versions/{version_id}",
            json={
                "label": "Finalized Resume",
                "raw_text": "Updated and finalized resume content for job applications.",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["label"] == "Finalized Resume"
        assert "finalized" in data["raw_text"].lower()

    async def test_update_nonexistent_version_returns_404(self, student_client):
        """Should return 404 when trying to update a version that doesn't exist."""
        response = await student_client.put(
            "/api/v1/resume/versions/nonexistent-uuid-12345",
            json={"label": "Updated"},
        )

        assert response.status_code == 404

    async def test_delete_version(self, student_client):
        """Should delete a version and return confirmation."""
        # Create a version
        create_resp = await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "To Be Deleted",
                "raw_text": "This version will be deleted during testing.",
            },
        )
        version_id = create_resp.json()["id"]

        # Delete it
        response = await student_client.delete(
            f"/api/v1/resume/versions/{version_id}"
        )

        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

        # Verify it's gone
        list_resp = await student_client.get("/api/v1/resume/versions")
        ids = [v["id"] for v in list_resp.json()["versions"]]
        assert version_id not in ids

    async def test_delete_nonexistent_version_returns_404(self, student_client):
        """Should return 404 when trying to delete a version that doesn't exist."""
        response = await student_client.delete(
            "/api/v1/resume/versions/nonexistent-uuid-99999"
        )

        assert response.status_code == 404

    async def test_versions_unauthenticated(self, unauthenticated_client):
        """Should return 401 when no auth token is provided."""
        response = await unauthenticated_client.get("/api/v1/resume/versions")
        assert response.status_code == 401

    async def test_clone_version(self, student_client):
        """Should clone a version with a new label and incremented version number."""
        # Create a source version
        create_resp = await student_client.post(
            "/api/v1/resume/versions",
            json={
                "label": "Source Version",
                "raw_text": "This is the source resume that will be cloned.",
            },
        )
        source_id = create_resp.json()["id"]

        # Clone it
        response = await student_client.post(
            f"/api/v1/resume/versions/{source_id}/clone"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] != source_id
        assert data["version_number"] > 1
        assert "Copy of" in data["label"]
        # Content should be identical
        assert data["raw_text"] == "This is the source resume that will be cloned."
