"""
Processed Webhook Event Model — idempotency ledger for payment providers.

Stripe retries a webhook until it gets a 2xx, and a replayed
`checkout.session.completed` would otherwise credit the same purchase again.
Every handled event id is recorded here first; a duplicate insert fails on the
primary key and the handler skips the side effects.
"""

from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class ProcessedWebhookEvent(Base):
    __tablename__ = "processed_webhook_events"

    # Provider event id, e.g. Stripe's "evt_1234...".
    id = Column(String(255), primary_key=True)
    provider = Column(String(30), nullable=False, default="stripe")
    event_type = Column(String(100), nullable=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
