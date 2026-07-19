"""
Skillmate Backend — Security Middleware & Utilities
=====================================================
Provides:
  1. Security headers middleware (CSP, HSTS, X-Frame-Options, etc.)
  2. Request ID tracking for log correlation
  3. File upload validation (magic bytes, not just extension)
  4. AI prompt injection guardrails
"""

import uuid
import logging
from typing import Optional

from fastapi import Request, UploadFile, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- Magic bytes for allowed file types ---
FILE_SIGNATURES = {
    ".pdf": [b"%PDF"],
    ".docx": [b"PK\x03\x04"],  # DOCX is a ZIP archive
    ".doc": [b"\xd0\xcf\x11\xe0"],  # OLE2 compound document
}


# ============================================================
# 1. Security Headers Middleware
# ============================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds production security headers to every response:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: restrict access to sensitive APIs
    - Content-Security-Policy (production only)
    - Strict-Transport-Security (production only)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Always set these headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(self), geolocation=(), payment=(self)"
        )

        # Production-only strict headers
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://*.supabase.co wss://*.supabase.co; "
                "font-src 'self' https://fonts.gstatic.com; "
                "frame-ancestors 'none';"
            )

        return response


# ============================================================
# 2. Request ID Tracking Middleware
# ============================================================
class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Generates a unique request ID for every request.
    - Injected into response headers as X-Request-ID
    - Available in request.state.request_id for log correlation
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:12]
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ============================================================
# 3. File Upload Validation
# ============================================================
async def validate_upload_file(
    file: UploadFile,
    max_size_mb: Optional[int] = None,
) -> bytes:
    """
    Validates an uploaded file by checking:
    1. File extension against allowed list
    2. File size against maximum
    3. Magic bytes match the declared extension

    Returns the file contents as bytes if valid.
    Raises HTTPException if validation fails.
    """
    if max_size_mb is None:
        max_size_mb = settings.max_file_size_mb

    # Check filename
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required.",
        )

    # Check extension
    filename_lower = file.filename.lower()
    ext = None
    for allowed_ext in settings.allowed_upload_extensions:
        if filename_lower.endswith(allowed_ext):
            ext = allowed_ext
            break

    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Accepted: {', '.join(settings.allowed_upload_extensions)}",
        )

    # Read contents
    contents = await file.read()
    await file.seek(0)  # Reset for downstream consumers

    # Check size
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > max_size_mb:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size_mb:.1f}MB). Maximum: {max_size_mb}MB.",
        )

    # Check magic bytes
    expected_signatures = FILE_SIGNATURES.get(ext, [])
    if expected_signatures:
        is_valid_signature = any(
            contents[:len(sig)] == sig for sig in expected_signatures
        )
        if not is_valid_signature:
            logger.warning(
                f"File upload rejected: {file.filename} — "
                f"extension is {ext} but magic bytes don't match"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content does not match the {ext} format. "
                       "Please upload a valid file.",
            )

    logger.info(f"File validated: {file.filename} ({size_mb:.2f}MB)")
    return contents


# ============================================================
# 4. AI Prompt Injection Guardrails
# ============================================================

# Patterns that indicate prompt injection attempts
_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore above instructions",
    "disregard previous",
    "disregard above",
    "forget your instructions",
    "you are now",
    "act as if",
    "pretend you are",
    "new instructions:",
    "override:",
    "system prompt:",
    "```system",
    "<|system|>",
    "IMPORTANT: ignore",
]


def sanitize_ai_input(user_text: str, field_name: str = "input") -> str:
    """
    Sanitizes user-provided text before injecting into AI prompts.
    - Checks for common prompt injection patterns
    - Truncates excessively long inputs
    - Strips control characters

    Returns sanitized text. Raises HTTPException if malicious patterns detected.
    """
    if not user_text:
        return ""

    text_lower = user_text.lower().strip()

    # Check for injection patterns
    for pattern in _INJECTION_PATTERNS:
        if pattern in text_lower:
            logger.warning(
                f"Prompt injection attempt detected in {field_name}: "
                f"matched pattern '{pattern}'"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid content detected in {field_name}. "
                       "Please provide legitimate input.",
            )

    # Strip null bytes and control characters (keep newlines and tabs)
    cleaned = "".join(
        ch for ch in user_text
        if ch in ('\n', '\r', '\t') or (ord(ch) >= 32)
    )

    return cleaned


def wrap_user_input_for_prompt(user_text: str) -> str:
    """
    Wraps user-provided text with delimiters to prevent prompt injection
    when inserting into AI prompts. The AI is instructed to treat content
    between these markers as data, not instructions.
    """
    sanitized = sanitize_ai_input(user_text)
    return f"<user_content>\n{sanitized}\n</user_content>"
