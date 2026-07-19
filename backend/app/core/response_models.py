"""
Skillmate AI — Standard Response Wrappers
==========================================
Generic Pydantic models that wrap every API response in a consistent
envelope so frontend clients and API consumers always have a predictable
shape regardless of which endpoint they hit.

Usage
-----
# Simple endpoint
@router.post("/score", response_model=SuccessResponse[ATSResponse])
async def my_route(...) -> SuccessResponse[ATSResponse]:
    data = ATSResponse(...)
    return success(data, credits_used=1)

# Paginated list
@router.get("/history", response_model=PaginatedResponse[HistoryItem])
async def list_history(...) -> PaginatedResponse[HistoryItem]:
    return paginate(items, total=total, page=page, per_page=20)
"""

from __future__ import annotations

import uuid
from typing import Generic, List, Optional, TypeVar

from fastapi import Request
from pydantic import BaseModel, Field

# ── Generic type parameter ──────────────────────────────────────
T = TypeVar("T")


# ══════════════════════════════════════════════════════════════
#  1. Success envelope
# ══════════════════════════════════════════════════════════════

class SuccessResponse(BaseModel, Generic[T]):
    """
    Standard success wrapper used by all non-paginated endpoints.

    Fields
    ------
    data        : The actual response payload (any Pydantic model or primitive).
    message     : Optional human-readable status message.
    credits_used: How many credits this call consumed (0 if free).
    request_id  : Correlation ID — matches the X-Request-ID response header.
    """

    success: bool = True
    data: T
    message: str = "OK"
    credits_used: int = Field(default=0, ge=0)
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])

    model_config = {"json_schema_extra": {
        "example": {
            "success": True,
            "data": {},
            "message": "OK",
            "credits_used": 1,
            "request_id": "a1b2c3d4",
        }
    }}


# ══════════════════════════════════════════════════════════════
#  2. Error envelope
# ══════════════════════════════════════════════════════════════

class ErrorResponse(BaseModel):
    """
    Standard error shape returned by exception handlers.
    Never raised directly — raise HTTPException and let the handler wrap it.

    Fields
    ------
    error_code : Machine-readable slug (e.g. "INSUFFICIENT_CREDITS").
    message    : Human-readable explanation safe to show in a UI.
    details    : Optional list of field-level validation errors.
    request_id : Matches X-Request-ID header for log correlation.
    """

    success: bool = False
    error_code: str
    message: str
    details: Optional[List[dict]] = None
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])

    model_config = {"json_schema_extra": {
        "example": {
            "success": False,
            "error_code": "INSUFFICIENT_CREDITS",
            "message": "You need 2 credits but only have 1.",
            "details": None,
            "request_id": "a1b2c3d4",
        }
    }}

    # ── Convenience constructors ────────────────────────────
    @classmethod
    def from_http(cls, status_code: int, detail: str, request_id: str = "") -> "ErrorResponse":
        """Map an HTTPException into an ErrorResponse."""
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            402: "INSUFFICIENT_CREDITS",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMITED",
            500: "INTERNAL_ERROR",
            503: "SERVICE_UNAVAILABLE",
        }
        return cls(
            error_code=code_map.get(status_code, "UNKNOWN_ERROR"),
            message=detail,
            request_id=request_id,
        )


# ══════════════════════════════════════════════════════════════
#  3. Paginated envelope
# ══════════════════════════════════════════════════════════════

class PaginatedResponse(BaseModel, Generic[T]):
    """
    Wrapper for list endpoints.

    Fields
    ------
    items    : The page of results.
    total    : Total record count across ALL pages.
    page     : Current page (1-indexed).
    per_page : Items per page.
    pages    : Total page count (computed).
    has_next : Convenience flag for UI.
    has_prev : Convenience flag for UI.
    """

    success: bool = True
    items: List[T]
    total: int = Field(ge=0)
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)

    @property
    def pages(self) -> int:
        return max(1, -(-self.total // self.per_page))  # ceiling division

    @property
    def has_next(self) -> bool:
        return self.page < self.pages

    @property
    def has_prev(self) -> bool:
        return self.page > 1

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "items": [],
                "total": 42,
                "page": 1,
                "per_page": 20,
            }
        }
    }


# ══════════════════════════════════════════════════════════════
#  4. Helper factory functions
# ══════════════════════════════════════════════════════════════

def success(
    data: T,
    message: str = "OK",
    credits_used: int = 0,
    request: "Request | None" = None,
) -> SuccessResponse[T]:
    """
    Convenience constructor for SuccessResponse.
    Pulls request_id from the ASGI request state if available so it matches
    the X-Request-ID header already set by RequestIDMiddleware.

    Example
    -------
    return success(ats_result, credits_used=1, request=request)
    """
    req_id = ""
    if request is not None:
        req_id = getattr(request.state, "request_id", "") or ""
    return SuccessResponse(
        data=data,
        message=message,
        credits_used=credits_used,
        request_id=req_id or str(uuid.uuid4())[:8],
    )


def paginate(
    items: List[T],
    total: int,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedResponse[T]:
    """Convenience constructor for PaginatedResponse."""
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


# ══════════════════════════════════════════════════════════════
#  5. OpenAPI response schemas (reusable across routes)
# ══════════════════════════════════════════════════════════════

#: Pass this as `responses=COMMON_ERRORS` to any route decorator to get the
#: standard 401/402/422/500 blocks in the Swagger UI automatically.
COMMON_ERRORS: dict = {
    401: {
        "description": "Missing or invalid Bearer token",
        "content": {
            "application/json": {
                "example": {
                    "success": False,
                    "error_code": "UNAUTHORIZED",
                    "message": "Missing authentication token",
                    "request_id": "a1b2c3d4",
                }
            }
        },
    },
    402: {
        "description": "Insufficient credits",
        "content": {
            "application/json": {
                "example": {
                    "success": False,
                    "error_code": "INSUFFICIENT_CREDITS",
                    "message": "Required: 2, Available: 0",
                    "request_id": "a1b2c3d4",
                }
            }
        },
    },
    422: {
        "description": "Validation error — missing or malformed fields",
        "content": {
            "application/json": {
                "example": {
                    "success": False,
                    "error_code": "VALIDATION_ERROR",
                    "message": "resume_file or resume_text is required",
                    "details": [{"field": "resume_file", "msg": "field required"}],
                    "request_id": "a1b2c3d4",
                }
            }
        },
    },
    500: {
        "description": "Internal server error",
        "content": {
            "application/json": {
                "example": {
                    "success": False,
                    "error_code": "INTERNAL_ERROR",
                    "message": "ATS analysis failed",
                    "request_id": "a1b2c3d4",
                }
            }
        },
    },
}
