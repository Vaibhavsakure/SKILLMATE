"""
Credits API — Balance and transaction history endpoints.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.services.credit_service import get_user_credits as get_wallet, get_quota_info
from app.models.credit_models import CreditTransaction

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Response Models ---
class CreditBalance(BaseModel):
    credits: int


class TransactionItem(BaseModel):
    id: int
    change: int
    reason: str
    created_at: str


class CreditHistory(BaseModel):
    transactions: List[TransactionItem]


class QuotaResponse(BaseModel):
    used: int
    limit: int
    resets_at: str


# --- Endpoints ---

@router.get("/balance", response_model=CreditBalance)
async def get_balance(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current credit balance for the user."""
    user_id = user.get("id")

    try:
        wallet = get_wallet(db, user_id)
        return CreditBalance(credits=wallet.credits)
    except Exception as e:
        logger.error(f"Error fetching balance for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch credit balance")


@router.get("/history", response_model=CreditHistory)
async def get_history(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get credit transaction history."""
    user_id = user.get("id")

    try:
        results = (
            db.query(CreditTransaction)
            .filter(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.created_at.desc())
            .limit(20)
            .all()
        )

        transactions = [
            TransactionItem(
                id=tx.id,
                change=tx.change,
                reason=tx.reason,
                created_at=str(tx.created_at) if tx.created_at else "",
            )
            for tx in results
        ]

        return CreditHistory(transactions=transactions)

    except Exception as e:
        logger.error(f"History fetch error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch credit history")


@router.get("/quota", response_model=QuotaResponse)
async def get_quota(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the user's current monthly AI call quota status.

    Returns:
        used:      number of AI calls made this calendar month
        limit:     maximum allowed (50 for free, 500 for pro)
        resets_at:  ISO-8601 timestamp of next month reset
    """
    user_id = user.get("id")

    try:
        return QuotaResponse(**get_quota_info(db, user_id))
    except Exception as e:
        logger.error(f"Quota fetch error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch quota info")