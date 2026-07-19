"""
Skillmate AI — Structured JSON Logger
=======================================
Provides a drop-in replacement for standard logging that emits
structured JSON records, ideal for log aggregators (Datadog, Loki,
CloudWatch Logs Insights, etc.).

Each log record includes:
  timestamp, level, logger, message,
  request_id, user_id, endpoint, method, duration_ms,
  environment, release, exc_info (on errors)

Usage:
  from app.core.logger import get_logger
  logger = get_logger(__name__)
  logger.info("ATS score computed", extra={"user_id": uid, "score": 78})

Middleware integration (main.py):
  The RequestLoggingMiddleware injects request_id + timing automatically.
"""

from __future__ import annotations

import json
import logging
import sys
import traceback
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

# ── Context variables (set per-request by middleware) ──────────
_request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
_user_id_var: ContextVar[str] = ContextVar("user_id", default="-")
_endpoint_var: ContextVar[str] = ContextVar("endpoint", default="-")
_method_var: ContextVar[str] = ContextVar("method", default="-")


def set_request_context(
    request_id: str,
    user_id: str = "-",
    endpoint: str = "-",
    method: str = "-",
) -> None:
    """Call from middleware to inject per-request context into all log records."""
    _request_id_var.set(request_id)
    _user_id_var.set(user_id)
    _endpoint_var.set(endpoint)
    _method_var.set(method)


def clear_request_context() -> None:
    """Reset context vars after request completes."""
    _request_id_var.set("-")
    _user_id_var.set("-")
    _endpoint_var.set("-")
    _method_var.set("-")


# ── JSON Formatter ─────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """
    Emits one JSON object per line.
    All standard LogRecord attributes + context vars + any `extra` dict
    fields are merged into the output.
    """

    # Fields from LogRecord we always want in the output
    _STANDARD_FIELDS = frozenset({
        "message", "timestamp", "level", "logger",
        "request_id", "user_id", "endpoint", "method",
        "duration_ms", "environment", "release",
        "exc_info", "stack_info",
    })

    def __init__(self, environment: str = "development", release: str = "skillmate@3.0.0"):
        super().__init__()
        self._environment = environment
        self._release = release

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        # Base record
        record.message = record.getMessage()

        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.message,
            # Per-request context (populated by middleware)
            "request_id": _request_id_var.get(),
            "user_id": _user_id_var.get(),
            "endpoint": _endpoint_var.get(),
            "method": _method_var.get(),
            # App-level metadata
            "environment": self._environment,
            "release": self._release,
        }

        # Exception info
        if record.exc_info and record.exc_info[0] is not None:
            payload["exc_type"] = record.exc_info[0].__name__
            payload["exc_message"] = str(record.exc_info[1])
            payload["traceback"] = "".join(traceback.format_exception(*record.exc_info))

        # Stack info (from logger.exception with stack_info=True)
        if record.stack_info:
            payload["stack_info"] = record.stack_info

        # Merge any extra= fields passed by the caller
        # (exclude internal LogRecord attributes to avoid noise)
        _internal = frozenset(vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys())
        for key, value in vars(record).items():
            if key not in _internal and key not in self._STANDARD_FIELDS:
                payload[key] = value

        return json.dumps(payload, default=str, ensure_ascii=False)


# ── Handler factory ─────────────────────────────────────────────

def _make_json_handler(environment: str, release: str) -> logging.StreamHandler:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter(environment=environment, release=release))
    return handler


# ── Public API ──────────────────────────────────────────────────

_configured = False


def configure_logging(
    environment: str = "development",
    release: str = "skillmate@3.0.0",
    log_level: str = "INFO",
) -> None:
    """
    Call ONCE at application startup (before any imports that use logging).
    Replaces the root handler with the JSON formatter.

    In development we keep a readable human format; in staging/production
    we emit structured JSON.
    """
    global _configured
    if _configured:
        return
    _configured = True

    level = getattr(logging, log_level.upper(), logging.INFO)

    if environment == "development":
        # Human-readable format for local dev
        logging.basicConfig(
            level=level,
            format="%(asctime)s | %(levelname)-7s | %(name)-30s | %(message)s",
            datefmt="%H:%M:%S",
            stream=sys.stdout,
            force=True,
        )
    else:
        # Structured JSON for staging / production
        root_logger = logging.getLogger()
        root_logger.setLevel(level)

        # Remove existing handlers to avoid duplicate output
        root_logger.handlers.clear()
        root_logger.addHandler(_make_json_handler(environment, release))

    # Silence noisy third-party loggers
    for noisy in ("httpx", "httpcore", "uvicorn.access", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("skillmate").info(
        "Logging configured",
        extra={"environment": environment, "log_level": log_level},
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger namespaced under 'skillmate.*'.
    Prefer this over logging.getLogger() directly.
    """
    if not name.startswith("skillmate"):
        name = f"skillmate.{name}"
    return logging.getLogger(name)


# ── Request Logging Middleware ─────────────────────────────────

class RequestLoggingMiddleware:
    """
    ASGI middleware that:
      1. Extracts the X-Request-ID header (set by RequestIDMiddleware).
      2. Injects request context into ContextVars for JSON logging.
      3. Logs every request with method, path, status, and duration_ms.
      4. Increments the in-process request counter.
    """

    def __init__(self, app):
        self.app = app
        self._logger = get_logger("skillmate.http")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        import time
        from app.core.monitoring import increment_counter

        start = time.perf_counter()

        # Extract metadata from ASGI scope
        headers = dict(scope.get("headers", []))
        request_id = headers.get(b"x-request-id", b"-").decode("utf-8", errors="replace")
        method = scope.get("method", "-")
        path = scope.get("path", "-")

        set_request_context(request_id=request_id, endpoint=path, method=method)
        increment_counter("request_count")

        # Intercept the response status code
        status_code: list[int] = [0]

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code[0] = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            status = status_code[0]
            log_fn = self._logger.warning if status >= 500 else self._logger.info

            log_fn(
                f"{method} {path} → {status}",
                extra={
                    "http_method": method,
                    "http_path": path,
                    "http_status": status,
                    "duration_ms": duration_ms,
                },
            )
            clear_request_context()
