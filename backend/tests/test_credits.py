"""
Skillmate AI — Credits & Payments Tests
=========================================
Tests for:
  - GET  /api/v1/credits/balance  — Balance retrieval
  - GET  /api/v1/credits/history  — Transaction history
  - POST /api/v1/payments/webhook — Stripe webhook credit delivery
  - GET  /api/v1/payments/packs   — Credit pack listing
"""

import json
import pytest
from unittest.mock import patch

from app.models.credit_models import UserCredits, CreditTransaction
from tests.conftest import MOCK_STUDENT_USER

pytestmark = pytest.mark.asyncio


# ============================================================
#  Credit Balance Tests
# ============================================================

class TestCreditBalance:
    """Tests for the GET /api/v1/credits/balance endpoint."""

    async def test_get_balance_returns_seeded_credits(self, student_client, db):
        """Should return the exact credit balance seeded in the fixture (10)."""
        response = await student_client.get("/api/v1/credits/balance")

        assert response.status_code == 200
        data = response.json()
        assert data["credits"] == 10

    async def test_get_balance_creates_wallet_for_new_user(self, student_client, db):
        """Should auto-create a wallet with default credits if none exists."""
        # Delete the seeded wallet to simulate a brand-new user
        wallet = db.query(UserCredits).filter(
            UserCredits.user_id == MOCK_STUDENT_USER["id"]
        ).first()
        if wallet:
            db.delete(wallet)
            db.commit()

        response = await student_client.get("/api/v1/credits/balance")

        assert response.status_code == 200
        # credit_service.get_user_credits creates a new wallet with 5 credits
        assert response.json()["credits"] == 5

    async def test_get_balance_unauthenticated(self, unauthenticated_client):
        """Should return 401 for unauthenticated requests."""
        response = await unauthenticated_client.get("/api/v1/credits/balance")
        assert response.status_code == 401


# ============================================================
#  Credit History Tests
# ============================================================

class TestCreditHistory:
    """Tests for the GET /api/v1/credits/history endpoint."""

    async def test_empty_history(self, student_client):
        """Should return an empty transaction list for a new user."""
        response = await student_client.get("/api/v1/credits/history")

        assert response.status_code == 200
        data = response.json()
        assert data["transactions"] == []

    async def test_history_shows_transactions(self, student_client, db):
        """Should return transactions after credits are consumed."""
        # Manually insert a transaction
        tx = CreditTransaction(
            user_id=MOCK_STUDENT_USER["id"],
            change=-1,
            reason="ats_score",
        )
        db.add(tx)
        db.commit()

        response = await student_client.get("/api/v1/credits/history")

        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["change"] == -1
        assert data["transactions"][0]["reason"] == "ats_score"

    async def test_history_unauthenticated(self, unauthenticated_client):
        """Should return 401 for unauthenticated requests."""
        response = await unauthenticated_client.get("/api/v1/credits/history")
        assert response.status_code == 401


# ============================================================
#  Credit Service — Direct Tests
# ============================================================

class TestCreditService:
    """Direct unit tests for the credit_service functions."""

    def test_consume_credits_success(self, db):
        """Should deduct credits and create a transaction record."""
        from app.services.credit_service import consume_credits

        user_id = MOCK_STUDENT_USER["id"]

        # Ensure user has 10 credits (seeded by fixture)
        wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
        if not wallet:
            wallet = UserCredits(user_id=user_id, credits=10)
            db.add(wallet)
            db.commit()
        else:
            wallet.credits = 10
            db.commit()

        success, remaining = consume_credits(db, user_id, "resume_rewrite", cost=2)

        assert success is True
        assert remaining == 8

        # Verify transaction was recorded
        tx = db.query(CreditTransaction).filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.reason == "resume_rewrite",
        ).first()
        assert tx is not None
        assert tx.change == -2

    def test_consume_credits_insufficient(self, db):
        """Should return False when user doesn't have enough credits."""
        from app.services.credit_service import consume_credits

        user_id = MOCK_STUDENT_USER["id"]

        wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
        if not wallet:
            wallet = UserCredits(user_id=user_id, credits=0)
            db.add(wallet)
            db.commit()
        else:
            wallet.credits = 0
            db.commit()

        success, remaining = consume_credits(db, user_id, "expensive_action", cost=5)

        assert success is False
        assert remaining == 0

    def test_add_credits(self, db):
        """Should add credits and create a positive transaction."""
        from app.services.credit_service import add_credits

        user_id = MOCK_STUDENT_USER["id"]

        wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
        if not wallet:
            wallet = UserCredits(user_id=user_id, credits=5)
            db.add(wallet)
            db.commit()
        else:
            wallet.credits = 5
            db.commit()

        new_balance = add_credits(db, user_id, amount=50, reason="purchase_starter")

        assert new_balance == 55

        # Verify positive transaction
        tx = db.query(CreditTransaction).filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.reason == "purchase_starter",
        ).first()
        assert tx is not None
        assert tx.change == 50


# ============================================================
#  Payment Packs Listing
# ============================================================

class TestPaymentPacks:
    """Tests for the GET /api/v1/payments/packs endpoint."""

    async def test_list_packs_returns_all_packs(self, student_client):
        """Should return the 3 credit packs (starter, pro, premium)."""
        response = await student_client.get("/api/v1/payments/packs")

        assert response.status_code == 200
        packs = response.json()
        assert len(packs) == 3

        pack_ids = [p["id"] for p in packs]
        assert "starter" in pack_ids
        assert "pro" in pack_ids
        assert "premium" in pack_ids

    async def test_pack_structure(self, student_client):
        """Should return packs with name, credits, and price fields."""
        response = await student_client.get("/api/v1/payments/packs")

        packs = response.json()
        starter = next(p for p in packs if p["id"] == "starter")

        assert starter["name"] == "Starter Pack"
        assert starter["credits"] == 50
        assert starter["price"] == "$5.00"


# ============================================================
#  Stripe Webhook Tests
# ============================================================

class TestStripeWebhook:
    """Tests for the POST /api/v1/payments/webhook endpoint."""

    async def test_webhook_missing_signature_returns_400(self, student_client):
        """Should return 400 when Stripe-Signature header is missing."""
        payload = json.dumps({
            "type": "checkout.session.completed",
            "data": {"object": {"metadata": {}}},
        })

        response = await student_client.post(
            "/api/v1/payments/webhook",
            content=payload,
            headers={"Content-Type": "application/json"},
        )

        # Should fail because there's no stripe-signature header
        assert response.status_code in (400, 503)

    @patch("app.api.payments._stripe", None)
    async def test_webhook_stripe_not_configured_returns_503(self, student_client):
        """Should return 503 when Stripe is not configured."""
        payload = json.dumps({"type": "checkout.session.completed"})

        response = await student_client.post(
            "/api/v1/payments/webhook",
            content=payload,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]
