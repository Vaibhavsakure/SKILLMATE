"""
Skillmate Backend — Credits Service (Lightweight)
===================================================
Self-contained credit lookup. Used by core/deps.py for require_credits.
"""

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.credit_models import UserCredits, CreditTransaction


def get_user_credits(user_id: str) -> int:
    """
    Fetches the current credit balance for a user.
    Uses a self-contained DB session.
    """
    with SessionLocal() as db:
        wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()
        if wallet:
            return wallet.credits
        return 0


def deduct_credits(user_id: str, amount: int, reason: str = "resume_rewrite") -> bool:
    """
    Deducts credits and logs the transaction.
    Returns True if successful, False if insufficient funds.
    """
    with SessionLocal() as db:
        try:
            wallet = db.query(UserCredits).filter(UserCredits.user_id == user_id).first()

            if not wallet or wallet.credits < amount:
                return False

            wallet.credits -= amount

            transaction = CreditTransaction(
                user_id=user_id,
                change=-amount,
                reason=reason,
            )
            db.add(transaction)
            db.commit()
            return True

        except Exception as e:
            db.rollback()
            print(f"❌ Error deducting credits: {e}")
            return False