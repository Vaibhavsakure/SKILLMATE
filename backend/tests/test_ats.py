"""
Skillmate AI — ATS Score Endpoint Tests
=========================================
Tests the POST /api/v1/ats/score endpoint:
  - Happy path: resume text + JD → AI score
  - Missing resume data → 400
  - Unauthorized request → 401
  - AI service failure → 500
"""

import pytest
from unittest.mock import patch, AsyncMock

pytestmark = pytest.mark.asyncio


# ── Fixed AI response for deterministic tests ──────────────────
MOCK_ATS_RESPONSE = {
    "score": 78,
    "missing_keywords": ["Kubernetes", "GraphQL"],
    "suggestions": [
        "Add metrics to your project achievements",
        "Include cloud certifications (AWS, GCP)",
    ],
}

SAMPLE_JD = (
    "We are looking for a Senior Backend Engineer with strong Python, "
    "FastAPI, PostgreSQL, and AWS experience. Kubernetes knowledge is a plus."
)

SAMPLE_RESUME_TEXT = (
    "Experienced software engineer with 5 years of Python development. "
    "Built REST APIs using FastAPI, managed PostgreSQL databases, and "
    "deployed services to AWS EC2 and Lambda."
)


def payload(response):
    """
    Return the ATS payload from the SuccessResponse envelope.

    /ats/score declares response_model=SuccessResponse[ATSResponse], so the
    body is {success, data, message, credits_used, request_id}. These tests
    originally asserted against the flat shape.
    """
    body = response.json()
    assert body["success"] is True
    return body["data"]


class TestATSScoreHappyPath:
    """Tests for successful ATS score calculations."""

    @patch("app.api.ats_score.ai_service.generate_json", new_callable=AsyncMock)
    async def test_ats_score_with_resume_text(self, mock_ai, student_client):
        """Should return a valid ATS score when resume text and JD are provided."""
        mock_ai.return_value = MOCK_ATS_RESPONSE

        response = await student_client.post(
            "/api/v1/ats/score",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME_TEXT,
            },
        )

        assert response.status_code == 200
        data = payload(response)
        assert data["score"] == 78
        assert "Kubernetes" in data["missing_keywords"]
        assert len(data["suggestions"]) == 2
        mock_ai.assert_awaited_once()

    @patch("app.api.ats_score.ai_service.generate_json", new_callable=AsyncMock)
    async def test_ats_score_cleans_dict_suggestions(self, mock_ai, student_client):
        """Should flatten dict-type suggestions into strings."""
        mock_ai.return_value = {
            "score": 65,
            "missing_keywords": [{"keyword": "Docker"}],
            "suggestions": [
                {"category": "Skills", "description": "Add container experience"},
            ],
        }

        response = await student_client.post(
            "/api/v1/ats/score",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME_TEXT,
            },
        )

        assert response.status_code == 200
        data = payload(response)
        assert data["score"] == 65
        # Dict keywords should be extracted
        assert data["missing_keywords"] == ["Docker"]
        # Dict suggestions should be flattened to strings
        assert "Skills: Add container experience" in data["suggestions"][0]

    @patch("app.api.ats_score.ai_service.generate_json", new_callable=AsyncMock)
    async def test_ats_score_zero_score_accepted(self, mock_ai, student_client):
        """Should accept a score of 0 as a valid response."""
        mock_ai.return_value = {
            "score": 0,
            "missing_keywords": ["Everything"],
            "suggestions": ["Complete resume overhaul needed"],
        }

        response = await student_client.post(
            "/api/v1/ats/score",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": "This is a very short and unrelated resume.",
            },
        )

        assert response.status_code == 200
        assert payload(response)["score"] == 0


class TestATSScoreValidation:
    """Tests for input validation and error handling."""

    async def test_ats_score_missing_resume_returns_400(self, student_client):
        """Should return 400 when neither resume_file nor resume_text is provided."""
        response = await student_client.post(
            "/api/v1/ats/score",
            data={"job_description": SAMPLE_JD},
        )

        assert response.status_code == 400
        assert "Missing resume data" in response.json()["detail"]

    async def test_ats_score_empty_resume_text_returns_400(self, student_client):
        """Should return 400 when resume_text is an empty string."""
        response = await student_client.post(
            "/api/v1/ats/score",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": "",
            },
        )

        assert response.status_code == 400

    @patch("app.api.ats_score.ai_service.generate_json", new_callable=AsyncMock)
    async def test_ats_score_ai_failure_returns_500(self, mock_ai, student_client):
        """Should return 500 when the AI service raises an exception."""
        mock_ai.side_effect = RuntimeError("AI provider timeout")

        response = await student_client.post(
            "/api/v1/ats/score",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME_TEXT,
            },
        )

        assert response.status_code == 500
        assert "ATS analysis failed" in response.json()["detail"]


class TestATSScoreAuth:
    """Tests for authentication enforcement."""

    async def test_ats_score_unauthenticated_returns_401(self, unauthenticated_client):
        """Should return 401 when no auth token is provided."""
        response = await unauthenticated_client.post(
            "/api/v1/ats/score",
            data={
                "job_description": SAMPLE_JD,
                "resume_text": SAMPLE_RESUME_TEXT,
            },
        )

        assert response.status_code == 401
        assert "authentication" in response.json()["detail"].lower()
