"""
Skillmate AI — Production Monitoring (Sentry + Metrics)
=========================================================
Provides:
  - Sentry SDK initialisation with PII scrubbing
  - In-process metrics counters (request_count, error_count, ai_provider_used)
  - get_metrics() helper consumed by the /metrics endpoint in main.py

Add to .env:
  SENTRY_DSN=https://....@....ingest.sentry.io/....
  SENTRY_TRACES_SAMPLE_RATE=0.2      # 20 % trace sampling
  SENTRY_PROFILES_SAMPLE_RATE=0.1    # 10 % profiling (optional)
"""

from __future__ import annotations

import re
import time
import logging
import threading
from typing import Any

logger = logging.getLogger("skillmate.monitoring")

# ── Startup timestamp (for uptime calculation) ──────────────────
_APP_START_TIME: float = time.time()

# ── Thread-safe in-process counters ────────────────────────────
_lock = threading.Lock()
_counters: dict[str, int] = {
    "request_count": 0,
    "error_count": 0,
    "ai_claude_count": 0,
    "ai_groq_count": 0,
    "ai_ollama_count": 0,
}

# ── PII patterns to scrub from Sentry events ───────────────────
_PII_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Email addresses
    (re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.I), "[email]"),
    # JWT tokens (Bearer eyJ...)
    (re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"), "[jwt_token]"),
    # Stripe secret/publishable keys
    (re.compile(r"sk_(?:test|live)_[A-Za-z0-9]{24,}"), "[stripe_secret]"),
    (re.compile(r"pk_(?:test|live)_[A-Za-z0-9]{24,}"), "[stripe_pk]"),
    # Anthropic API keys
    (re.compile(r"sk-ant-api\d+-[A-Za-z0-9\-_]{40,}"), "[anthropic_key]"),
    # Generic API keys (key=<value> patterns in query strings / bodies)
    (re.compile(r"(?:api[_-]?key|apikey|secret)[=:]\s*['\"]?[\w\-]{16,}['\"]?", re.I), "[api_key]"),
    # Supabase UUIDs tied to user_id (preserve structure, mask value)
    (re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I),
     "[uuid]"),
]

# Keys whose values should be blanked in Sentry request/extra data
_SENSITIVE_KEYS = frozenset({
    "resume_text", "resume_file", "cv_text", "raw_text",
    "password", "secret", "token", "authorization",
    "stripe_secret_key", "supabase_service_role_key",
    "anthropic_api_key", "groq_api_key",
})


def _scrub_string(value: str) -> str:
    """Apply all PII regex patterns to a single string."""
    for pattern, replacement in _PII_PATTERNS:
        value = pattern.sub(replacement, value)
    return value


def _scrub_dict(data: dict[str, Any], depth: int = 0) -> dict[str, Any]:
    """
    Recursively scrub PII from a dict.
    - Blanks values for known sensitive keys.
    - Applies regex scrubbing to string values.
    - Max depth 5 to avoid infinite recursion on pathological payloads.
    """
    if depth > 5:
        return data

    scrubbed: dict[str, Any] = {}
    for key, value in data.items():
        lower_key = key.lower()
        if any(sensitive in lower_key for sensitive in _SENSITIVE_KEYS):
            scrubbed[key] = "[scrubbed]"
        elif isinstance(value, str):
            # Truncate very large strings (resume texts) and scrub PII
            truncated = value[:2000] + "...[truncated]" if len(value) > 2000 else value
            scrubbed[key] = _scrub_string(truncated)
        elif isinstance(value, dict):
            scrubbed[key] = _scrub_dict(value, depth + 1)
        elif isinstance(value, list):
            scrubbed[key] = [
                _scrub_dict(item, depth + 1) if isinstance(item, dict)
                else (_scrub_string(item) if isinstance(item, str) else item)
                for item in value[:20]  # cap list length
            ]
        else:
            scrubbed[key] = value
    return scrubbed


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """
    Sentry before_send hook:
    1. Scrub PII from request body, form data, and extra context.
    2. Drop health-check and metrics noise events.
    3. Redact sensitive HTTP headers.
    """
    # 1. Drop noisy / irrelevant events
    request = event.get("request", {})
    url = request.get("url", "")
    if any(path in url for path in ["/health", "/metrics", "/favicon"]):
        return None  # Don't send these to Sentry

    # 2. Scrub HTTP request data
    if "data" in request:
        if isinstance(request["data"], dict):
            request["data"] = _scrub_dict(request["data"])
        elif isinstance(request["data"], str):
            request["data"] = _scrub_string(request["data"][:2000])

    # 3. Scrub HTTP headers (remove Authorization, Cookie)
    headers = request.get("headers", {})
    for sensitive_header in ("Authorization", "Cookie", "X-Api-Key"):
        if sensitive_header in headers:
            headers[sensitive_header] = "[scrubbed]"

    # 4. Scrub extra / contexts
    if "extra" in event and isinstance(event["extra"], dict):
        event["extra"] = _scrub_dict(event["extra"])

    if "contexts" in event and isinstance(event["contexts"], dict):
        event["contexts"] = _scrub_dict(event["contexts"])

    # 5. Increment internal error counter
    increment_counter("error_count")

    return event


def init_sentry(dsn: str, env: str, release: str = "skillmate@3.0.0") -> bool:
    """
    Initialise Sentry SDK.
    Safe to call even if DSN is empty (returns False without raising).

    Args:
        dsn:     Sentry DSN from settings.sentry_dsn
        env:     Application environment ("development" | "staging" | "production")
        release: Application release tag for Sentry release tracking

    Returns:
        True if Sentry was successfully initialised, False otherwise.
    """
    if not dsn:
        logger.info("ℹ️  Sentry DSN not configured — error tracking disabled")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        from app.core.config import settings as _settings

        traces_rate = getattr(_settings, "sentry_traces_sample_rate", 0.2)
        profiles_rate = getattr(_settings, "sentry_profiles_sample_rate", 0.1)

        sentry_sdk.init(
            dsn=dsn,
            environment=env,
            release=release,
            # Performance tracing — 20 % of transactions sampled
            traces_sample_rate=traces_rate,
            # Profiling (requires sentry-sdk[profiling]) — optional
            profiles_sample_rate=profiles_rate,
            # PII scrubbing hook
            before_send=_before_send,
            # Integrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(
                    level=logging.WARNING,      # Only WARNING+ goes to Sentry
                    event_level=logging.ERROR,  # Only ERROR+ creates Sentry events
                ),
            ],
            # Never send raw PII fields automatically
            send_default_pii=False,
            # Ignore common noise exceptions
            ignore_errors=[
                KeyboardInterrupt,
                SystemExit,
                # Add common FastAPI validation errors that aren't real errors
            ],
            # Limit breadcrumbs to reduce payload size
            max_breadcrumbs=30,
            attach_stacktrace=True,
        )

        logger.info(f"✅ Sentry initialised | env={env} | traces={traces_rate:.0%}")
        return True

    except ImportError:
        logger.warning("⚠️  sentry-sdk not installed — run: pip install 'sentry-sdk[fastapi]>=1.40'")
        return False
    except Exception as exc:
        logger.error(f"❌ Sentry init failed: {exc}")
        return False


# ── Counter helpers ─────────────────────────────────────────────

def increment_counter(name: str, amount: int = 1) -> None:
    """Thread-safe counter increment. Silently ignores unknown counter names."""
    with _lock:
        if name in _counters:
            _counters[name] += amount


def record_ai_provider(provider: str) -> None:
    """Record which AI provider fulfilled a request."""
    mapping = {
        "claude": "ai_claude_count",
        "groq": "ai_groq_count",
        "ollama": "ai_ollama_count",
    }
    key = mapping.get(provider.lower())
    if key:
        increment_counter(key)


def _get_circuit_breaker_states() -> dict[str, str]:
    """
    Lazily import circuit breaker singletons from ai_service and return their
    current states.  The lazy import avoids a circular dependency at module
    load time (ai_service → core.config; core.monitoring → ai_service would
    create a cycle if done at the top level).

    Returns a dict like: {"claude": "closed", "groq": "open", "ollama": "half_open"}
    """
    try:
        from app.services.ai_service import _cb_claude, _cb_groq, _cb_ollama  # noqa: PLC0415
        return {
            "claude": _cb_claude.state(),
            "groq":   _cb_groq.state(),
            "ollama": _cb_ollama.state(),
        }
    except Exception:
        return {"claude": "unknown", "groq": "unknown", "ollama": "unknown"}


def get_metrics() -> dict[str, Any]:
    """
    Returns a snapshot of the current in-process metrics.
    Called by the /metrics FastAPI endpoint.
    """
    with _lock:
        counts = dict(_counters)

    uptime_seconds = int(time.time() - _APP_START_TIME)
    total = counts["request_count"]
    errors = counts["error_count"]

    # Determine which AI provider has been used the most
    ai_counts = {
        "claude": counts["ai_claude_count"],
        "groq": counts["ai_groq_count"],
        "ollama": counts["ai_ollama_count"],
    }
    primary_ai = max(ai_counts, key=lambda k: ai_counts[k])

    return {
        "uptime_seconds": uptime_seconds,
        "uptime_human": _format_uptime(uptime_seconds),
        "request_count": total,
        "error_count": errors,
        "error_rate": round(errors / total, 4) if total > 0 else 0.0,
        "ai_provider_used": primary_ai,
        "ai_provider_counts": ai_counts,
        "ai_circuit_breakers": _get_circuit_breaker_states(),
    }


def _format_uptime(seconds: int) -> str:
    """Human-readable uptime string."""
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)
