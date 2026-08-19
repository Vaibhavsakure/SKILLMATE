"""
Payments API — Stripe integration for credit purchases.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.credit_service import add_credits
from app.workers.email_tasks import enqueue_email

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

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = settings.stripe_webhook_secret

    # ── Secret not configured ─────────────────────────────────────────────────
    if not webhook_secret:
        logger.error(
            "STRIPE_WEBHOOK_SECRET is not set — webhook signature verification "
            "is DISABLED. Set it immediately in production to prevent spoofed events."
        )
        # Return 200 so Stripe stops retrying and spamming logs.
        # Events are NOT processed without a verified secret.
        return {"status": "received", "warning": "signature verification disabled"}

    # ── Stripe not initialised ─────────────────────────────────────────────
    if not _stripe:
        logger.error("Stripe webhook received but Stripe is not initialised (no STRIPE_SECRET_KEY)")
        raise HTTPException(status_code=503, detail="Payment service not configured")

    # ── Verify signature ────────────────────────────────────────────────
    if not sig_header:
        logger.error("Webhook received without Stripe-Signature header | ip=%s",
                     request.client.host if request.client else "unknown")
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    try:
        event = _stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except Exception as e:
        logger.error(
            "Webhook signature verification failed | type=%s | msg=%s",
            type(e).__name__, e,
            exc_info=True,
        )
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # ── Log every incoming event type BEFORE processing ──────────────────────
    event_type = event.get("type", "unknown")
    event_id   = event.get("id", "unknown")
    logger.info(
        "Stripe webhook received | event_type=%s | event_id=%s",
        event_type, event_id,
    )

    # ── checkout.session.completed → credit purchase ───────────────────────
    if event_type == "checkout.session.completed":
        session  = event["data"]["object"]
        metadata = session.get("metadata", {})

        user_id        = metadata.get("user_id")
        pack_id        = metadata.get("pack_id")
        credits_amount = int(metadata.get("credits", 0))

        if user_id and credits_amount > 0:
            from app.core.database import SessionLocal
            db = SessionLocal()
            try:
                new_balance = add_credits(
                    db=db,
                    user_id=user_id,
                    amount=credits_amount,
                    reason=f"purchase_{pack_id}",
                )
                logger.info(
                    "Credits added | user=%s | pack=%s | added=%d | new_balance=%d",
                    user_id, pack_id, credits_amount, new_balance,
                )

                # ── Trigger 2: payment confirmation email ─────────────
                try:
                    # Resolve user email from the Stripe session
                    customer_email = session.get("customer_details", {}).get("email") or ""
                    customer_name  = session.get("customer_details", {}).get("name") or customer_email.split("@")[0]
                    amount_total   = session.get("amount_total", 0) or 0
                    amount_usd     = f"${amount_total / 100:.2f}"

                    if customer_email:
                        await enqueue_email(
                            "credits_purchased",
                            to_email=customer_email,
                            name=customer_name,
                            credits=credits_amount,
                            amount_usd=amount_usd,
                        )
                except Exception as _email_exc:
                    logger.warning(
                        "Payment confirmation email failed (non-fatal) | user=%s | error=%s",
                        user_id, _email_exc,
                    )
            except Exception as exc:
                # Payment succeeded but DB write failed — CRITICAL so it
                # appears in all alerting channels and can be fixed manually.
                logger.critical(
                    "CREDIT GRANT FAILED after successful payment | "
                    "user_id=%s | pack_id=%s | credits=%d | "
                    "event_id=%s | type=%s | msg=%s",
                    user_id, pack_id, credits_amount,
                    event_id, type(exc).__name__, exc,
                    exc_info=True,
                )
            finally:
                db.close()
        else:
            logger.warning(
                "checkout.session.completed received but metadata incomplete | "
                "user_id=%s | credits=%s | event_id=%s",
                user_id, credits_amount, event_id,
            )

    # ── Recruiter subscription events ─────────────────────────────────
    elif event_type in ("customer.subscription.created", "invoice.payment_succeeded"):
        session  = event["data"]["object"]
        metadata = session.get("metadata", {})
        if metadata.get("type") == "recruiter_subscription":
            logger.info(
                "Recruiter subscription event | user=%s | plan=%s | event_type=%s",
                metadata.get("user_id"), metadata.get("plan_id"), event_type,
            )

    else:
        logger.info("Unhandled Stripe event type: %s (no action taken)", event_type)

    return {"status": "received"}
