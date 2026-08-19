"""
Skillmate AI — Health Check & Smoke Tests
============================================
Basic tests that verify the app boots and core endpoints respond.
These run in CI without any external API keys.
"""

import pytest

pytestmark = pytest.mark.asyncio


class TestHealthEndpoint:
    """Test the /health endpoint."""

    async def test_health_returns_200(self, student_client):
        """Health check should always return 200 with service info."""
        response = await student_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "services" in data

    async def test_health_contains_database_status(self, student_client):
        """Health check should report database connectivity."""
        response = await student_client.get("/health")
        data = response.json()
        assert "database" in data["services"]

    async def test_health_contains_ai_providers(self, student_client):
        """Health check should report AI provider configuration."""
        response = await student_client.get("/health")
        data = response.json()
        assert "ai_providers" in data["services"]


class TestCoreEndpointsSmoke:
    """Smoke tests — verify endpoints exist and reject bad requests properly."""

    async def test_ats_score_requires_resume(self, student_client):
        """ATS score should return 400/422 without resume data."""
        response = await student_client.post(
            "/api/v1/ats/score",
            data={"job_description": "Test JD"},
        )
        # Should be 400 (missing resume) or 422 (validation error)
        assert response.status_code in [400, 422]

    async def test_credits_balance(self, student_client):
        """Credits endpoint should return user balance."""
        response = await student_client.get("/api/v1/credits/balance")
        assert response.status_code == 200

    async def test_stats_overview(self, student_client):
        """Stats overview should return dashboard data."""
        response = await student_client.get("/api/v1/stats/overview")
        assert response.status_code == 200

    async def test_history_empty(self, student_client):
        """History should return empty list for new user."""
        response = await student_client.get("/api/v1/history/")
        assert response.status_code == 200


class TestAuthGating:
    """Verify all sensitive endpoints reject unauthenticated requests."""

    PROTECTED_ENDPOINTS = [
        ("GET", "/api/v1/credits/balance"),
        ("GET", "/api/v1/stats/overview"),
        ("GET", "/api/v1/history/"),
        ("POST", "/api/v1/ats/score"),
        ("POST", "/api/v1/roast/roast"),
        ("POST", "/api/v1/cover-letter/generate"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    async def test_unauthenticated_returns_401(self, unauthenticated_client, method, path):
        """All protected endpoints should return 401 without auth."""
        if method == "GET":
            response = await unauthenticated_client.get(path)
        else:
            response = await unauthenticated_client.post(path)
        assert response.status_code == 401
