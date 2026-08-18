"""
Payments API — Stripe integration for credit purchases.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.credit_service import add_credits

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Stripe Setup ---
_stripe = None
try:
    import stripe
    if hasattr(settings, 'stripe_secret_key') and settings.stripe_secret_key:
        stripe.api_key = settings.stripe_secret_key
        _stripe = stripe
        logger.info("✅ Stripe initialized")
    else:
        logger.info("ℹ️ Stripe not configured (no STRIPE_SECRET_KEY)")
except ImportError:
    logger.warning("⚠️ stripe package not installed")

# Credit Packs
CREDIT_PACKS = {
    "starter": {"credits": 50, "price_cents": 500, "name": "Starter Pack"},
    "pro": {"credits": 120, "price_cents": 1000, "name": "Pro Pack"},
    "premium": {"credits": 300, "price_cents": 2000, "name": "Premium Pack"},
}

# Recruiter Subscription Plans (INR)
RECRUITER_PLANS = {
    "recruiter_starter": {
        "name": "Recruiter Starter",
        "price_inr_cents": 499900,   # ₹4,999
        "max_jobs": 3,
        "max_cvs_month": 200,
        "features": ["3 active job postings", "200 CV screens/month", "AI-powered ranking", "Email notifications"],
    },
    "recruiter_growth": {
        "name": "Recruiter Growth",
        "price_inr_cents": 999900,   # ₹9,999
        "max_jobs": 10,
        "max_cvs_month": 1000,
        "features": ["10 active job postings", "1,000 CV screens/month", "AI-powered ranking", "Email notifications", "Priority support"],
    },
}


# --- Models ---
class CheckoutRequest(BaseModel):
    pack_id: str  # "starter", "pro", "premium"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PackInfo(BaseModel):
    id: str
    name: str
    credits: int
    price: str


class RecruiterPlanInfo(BaseModel):
    id: str
    name: str
    price: str
    max_jobs: int
    max_cvs_month: int
    features: list


class RecruiterCheckoutRequest(BaseModel):
    plan_id: str  # "recruiter_starter" or "recruiter_growth"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


# --- Endpoints ---

@router.get("/packs")
async def list_packs():
    """List available credit packs."""
    return [
        PackInfo(
            id=pack_id,
            name=pack["name"],
            credits=pack["credits"],
            price=f"${pack['price_cents'] / 100:.2f}",
        )
        for pack_id, pack in CREDIT_PACKS.items()
    ]


@router.get("/recruiter-plans")
async def list_recruiter_plans():
    """List available recruiter subscription plans."""
    return [
        RecruiterPlanInfo(
            id=plan_id,
            name=plan["name"],
            price=f"₹{plan['price_inr_cents'] / 100:,.0f}/mo",
            max_jobs=plan["max_jobs"],
            max_cvs_month=plan["max_cvs_month"],
            features=plan["features"],
        )
        for plan_id, plan in RECRUITER_PLANS.items()
    ]


@router.post("/create-checkout", response_model=CheckoutResponse)
async def create_checkout(
    data: CheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Creates a Stripe Checkout Session for credit purchase."""

    if not _stripe:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    pack = CREDIT_PACKS.get(data.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail="Invalid pack ID")

    try:
        session = _stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Skillmate AI — {pack['name']}",
                        "description": f"{pack['credits']} AI credits for resume optimization and career tools",
                    },
                    "unit_amount": pack["price_cents"],
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=data.success_url or f"{settings.frontend_url}/dashboard/credits?success=true",
            cancel_url=data.cancel_url or f"{settings.frontend_url}/dashboard/credits?cancelled=true",
            metadata={
                "user_id": user.get("id"),
                "pack_id": data.pack_id,
                "credits": str(pack["credits"]),
            },
        )

        logger.info(f"Checkout session created for user {user.get('id')}: {data.pack_id}")

        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.id,
        )

    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/create-recruiter-checkout", response_model=CheckoutResponse)
async def create_recruiter_checkout(
    data: RecruiterCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Creates a Stripe Checkout Session for a recruiter subscription (INR, recurring)."""

    if not _stripe:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    plan = RECRUITER_PLANS.get(data.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid recruiter plan ID")

    try:
        session = _stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "inr",
                    "product_data": {
                        "name": f"Skillmate AI — {plan['name']}",
                        "description": f"Up to {plan['max_jobs']} jobs, {plan['max_cvs_month']} CVs/month",
                    },
                    "unit_amount": plan["price_inr_cents"],
                    "recurring": {"interval": "month"},
                },
                "quantity": 1,
            }],
            mode="subscription",
            success_url=data.success_url or f"{settings.frontend_url}/dashboard/recruiter?subscribed=true",
            cancel_url=data.cancel_url or f"{settings.frontend_url}/dashboard/recruiter?cancelled=true",
            metadata={
                "user_id": user.get("id"),
                "plan_id": data.plan_id,
                "type": "recruiter_subscription",
            },
        )

        logger.info(f"Recruiter subscription checkout created for user {user.get('id')}: {data.plan_id}")

        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.id,
        )

    except Exception as e:
        logger.error(f"Stripe recruiter checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription checkout")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handles Stripe webhook events (payment completion)."""

    if not _stripe:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    webhook_secret = settings.stripe_webhook_secret

    try:
        if not sig_header:
            logger.error("Webhook received without Stripe-Signature header")
            raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

        if webhook_secret:
            event = _stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            # No webhook secret configured — verify we're in development
            if settings.is_production:
                logger.error("STRIPE_WEBHOOK_SECRET not configured in production!")
                raise HTTPException(status_code=500, detail="Webhook verification not configured")
            import json
            event = json.loads(payload)
            logger.warning("⚠️ Webhook signature not verified — set STRIPE_WEBHOOK_SECRET!")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook signature error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type")
    event_id = event.get("id")

    # --- Idempotency ---
    # Stripe retries a webhook until it receives a 2xx, and the dashboard can
    # replay events by hand. Without this claim, one purchase could credit the
    # account any number of times.
    from app.core.database import SessionLocal
    from app.models.webhook_event import ProcessedWebhookEvent

    db = SessionLocal()
    try:
        if not event_id:
            logger.error("Webhook payload has no event id — refusing to process")
            raise HTTPException(status_code=400, detail="Webhook event is missing an id")

        already_seen = (
            db.query(ProcessedWebhookEvent)
            .filter(ProcessedWebhookEvent.id == event_id)
            .first()
        )
        if already_seen:
            logger.info(f"Webhook {event_id} ({event_type}) already processed — skipping")
            return {"status": "duplicate"}

        # Claim the event before running any side effect, so a crash mid-handler
        # cannot be replayed into a second credit grant.
        db.add(ProcessedWebhookEvent(
            id=event_id,
            provider="stripe",
            event_type=event_type,
        ))
        try:
            db.commit()
        except IntegrityError:
            # A concurrent delivery of the same event won the race.
            db.rollback()
            logger.info(f"Webhook {event_id} claimed concurrently — skipping")
            return {"status": "duplicate"}

        # Handle successful payment
        if event_type == "checkout.session.completed":
            session = event["data"]["object"]
            metadata = session.get("metadata", {}) or {}

            user_id = metadata.get("user_id")
            pack_id = metadata.get("pack_id")
            try:
                credits_amount = int(metadata.get("credits", 0))
            except (TypeError, ValueError):
                credits_amount = 0

            if user_id and credits_amount > 0:
                new_balance = add_credits(
                    db=db,
                    user_id=user_id,
                    amount=credits_amount,
                    reason=f"purchase_{pack_id}",
                )
                logger.info(
                    f"💰 Credits added: {credits_amount} for user {user_id}. "
                    f"New balance: {new_balance}"
                )

        # Handle recruiter subscription activated
        elif event_type in ("customer.subscription.created", "invoice.payment_succeeded"):
            session = event["data"]["object"]
            metadata = session.get("metadata", {}) or {}
            if metadata.get("type") == "recruiter_subscription":
                logger.info(
                    f"🏢 Recruiter subscription activated for user "
                    f"{metadata.get('user_id')}: {metadata.get('plan_id')}"
                )
    finally:
        db.close()

    return {"status": "received"}
