"""
Custom exception classes for the Skillmate AI backend.
Provides structured error handling across all API routes.
"""

from fastapi import HTTPException, status


class SkillmateException(HTTPException):
    """Base exception for all Skillmate-specific API errors."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)


class InsufficientCreditsError(SkillmateException):
    """Raised when a user doesn't have enough credits for an operation."""

    def __init__(self, required: int = 1, available: int = 0):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. Required: {required}, Available: {available}. Please top up.",
        )


class AIServiceUnavailableError(SkillmateException):
    """Raised when both Claude and Ollama fail to respond."""

    def __init__(self, detail: str = "AI service is temporarily unavailable. Please try again later."):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


class FileProcessingError(SkillmateException):
    """Raised when file parsing or processing fails."""

    def __init__(self, detail: str = "Failed to process the uploaded file."):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


class InputValidationError(SkillmateException):
    """Raised when user input fails sanitization or validation."""

    def __init__(self, detail: str = "Invalid input provided."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class ResourceNotFoundError(SkillmateException):
    """Raised when a requested resource (analysis, resume, etc.) doesn't exist."""

    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found.",
        )
