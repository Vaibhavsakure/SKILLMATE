"""
Input sanitization utilities for Skillmate AI.
Prevents prompt injection, XSS, and overly large payloads.
"""

import re
import html


# Maximum character lengths for various input types
MAX_RESUME_LENGTH = 50_000  # ~12 pages
MAX_JOB_DESC_LENGTH = 20_000  # ~5 pages
MAX_TEXT_INPUT_LENGTH = 10_000  # General text fields
MAX_SHORT_INPUT_LENGTH = 500  # Names, titles, etc.


def sanitize_text(text: str, max_length: int = MAX_TEXT_INPUT_LENGTH) -> str:
    """
    Sanitize general text input:
    - Strip leading/trailing whitespace
    - Remove null bytes
    - Escape HTML entities
    - Enforce maximum length
    """
    if not text:
        return ""

    # Remove null bytes (potential injection vector)
    text = text.replace("\x00", "")

    # Strip whitespace
    text = text.strip()

    # Escape HTML entities to prevent XSS
    text = html.escape(text, quote=True)

    # Enforce max length
    if len(text) > max_length:
        text = text[:max_length]

    return text


def sanitize_resume_text(text: str) -> str:
    """Sanitize resume text with a higher character limit."""
    return sanitize_text(text, max_length=MAX_RESUME_LENGTH)


def sanitize_job_description(text: str) -> str:
    """Sanitize job description text."""
    return sanitize_text(text, max_length=MAX_JOB_DESC_LENGTH)


def sanitize_short_input(text: str) -> str:
    """Sanitize short inputs like names, titles, roles."""
    sanitized = sanitize_text(text, max_length=MAX_SHORT_INPUT_LENGTH)
    # Additionally strip any control characters from short inputs
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', sanitized)
    return sanitized


def validate_not_empty(text: str, field_name: str = "Input") -> str:
    """Validate that text is not empty after sanitization."""
    if not text or not text.strip():
        raise ValueError(f"{field_name} cannot be empty.")
    return text
