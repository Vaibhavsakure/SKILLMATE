"""
Skillmate AI — OpenAPI / Swagger Documentation
================================================
Provides two things:

1.  custom_openapi(app)
    Call ONCE after app is created. Replaces FastAPI's default schema
    generator with one that adds contact, license, server list, and
    injects standard error response schemas into every operation.

2.  @document(summary, description, responses, tags)
    Lightweight decorator that sets FastAPI route metadata (summary,
    description, openapi_extra) WITHOUT altering the function signature,
    so it is 100% safe to layer on existing routes.

Wire-up (main.py)
-----------------
    from app.core.docs import configure_openapi
    configure_openapi(app)          # call after all routers are registered

Route usage
-----------
    from app.core.docs import document
    from app.core.response_models import COMMON_ERRORS, SuccessResponse

    @router.post("/score",
                 response_model=SuccessResponse[ATSResponse],
                 responses=COMMON_ERRORS,
                 **document(
                     summary="Scan resume against job description",
                     description="Uploads a PDF/DOCX resume and a job description text, "
                                 "returns an ATS compatibility score 0-100 plus missing "
                                 "keywords and actionable suggestions. Costs **1 credit**.",
                     response_example={
                         "score": 78,
                         "missing_keywords": ["Kubernetes", "Terraform"],
                         "suggestions": ["Add cloud certifications", "Quantify impact metrics"],
                     },
                 ))
    async def calculate_ats_score(...):
        ...
"""

from __future__ import annotations

import functools
from typing import Any, Callable, Dict, Optional

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

# ── Version constant (keep in sync with main.py) ───────────────
_API_VERSION = "3.0.0"


# ══════════════════════════════════════════════════════════════
#  1. Custom OpenAPI schema
# ══════════════════════════════════════════════════════════════

def configure_openapi(app: FastAPI) -> None:
    """
    Replace FastAPI's default openapi() with a richer custom schema.

    Call this ONCE at the bottom of main.py, after all routers are
    registered and after app = FastAPI(...) is created:

        configure_openapi(app)

    What it adds
    ------------
    · Title, version, description with markdown formatting
    · contact  — support email
    · license  — MIT
    · servers  — dev (localhost:8000) + prod (skillmate.ai/api)
    · tags with descriptions for every router group
    · x-logo extension for Redoc branding
    """

    def _build_schema() -> Dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title="Skillmate AI API",
            version=_API_VERSION,
            summary="AI-powered career acceleration platform",
            description=_DESCRIPTION,
            contact={
                "name": "Skillmate Support",
                "email": "support@skillmate.ai",
                "url": "https://skillmate.ai/support",
            },
            license_info={
                "name": "MIT",
                "url": "https://opensource.org/licenses/MIT",
            },
            routes=app.routes,
            tags=_TAG_METADATA,
        )

        # ── Servers (shown in the Swagger "Servers" dropdown) ──────────
        schema["servers"] = [
            {
                "url": "http://localhost:8000",
                "description": "Local development server",
            },
            {
                "url": "https://skillmate.ai/api/python",
                "description": "Production server",
            },
        ]

        # ── Redoc branding ──────────────────────────────────────────────
        schema.setdefault("info", {})["x-logo"] = {
            "url": "https://skillmate.ai/logo.png",
            "altText": "Skillmate AI",
        }

        # ── Security scheme: JWT Bearer ─────────────────────────────────
        schema.setdefault("components", {}).setdefault("securitySchemes", {})[
            "BearerAuth"
        ] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Supabase JWT — obtain from `/auth/v1/token` "
                           "or the Skillmate frontend login flow.",
        }

        # Apply global security to all operations that don't opt out
        for path_item in schema.get("paths", {}).values():
            for operation in path_item.values():
                if isinstance(operation, dict) and "security" not in operation:
                    operation["security"] = [{"BearerAuth": []}]

        app.openapi_schema = schema
        return schema

    app.openapi = _build_schema  # type: ignore[method-assign]


# ══════════════════════════════════════════════════════════════
#  2. @document decorator
# ══════════════════════════════════════════════════════════════

def document(
    summary: str,
    description: str = "",
    response_example: Optional[Dict[str, Any]] = None,
    responses: Optional[Dict[int, Any]] = None,
    tags: Optional[list[str]] = None,
    deprecated: bool = False,
) -> Dict[str, Any]:
    """
    Returns a dict of kwargs to unpack into a FastAPI route decorator.
    Does NOT wrap the function — zero overhead, no signature changes.

    Parameters
    ----------
    summary          Short one-line description (shown in Swagger list view).
    description      Markdown-formatted long description (shown in Swagger detail view).
    response_example Dict that becomes the 200 response example in OpenAPI.
    responses        Extra status-code blocks e.g. COMMON_ERRORS.
    tags             Override the router-level tag for this specific route.
    deprecated       Mark this route as deprecated in the docs.

    Example
    -------
    @router.post(
        "/score",
        response_model=SuccessResponse[ATSResponse],
        **document(
            summary="ATS resume scanner",
            description="Score a resume 0-100 against a job description.",
            response_example={"score": 78, "missing_keywords": ["Docker"]},
            responses=COMMON_ERRORS,
        ),
    )
    async def calculate_ats_score(...):
        ...
    """
    kwargs: Dict[str, Any] = {
        "summary": summary,
        "description": description,
        "deprecated": deprecated,
    }

    if tags:
        kwargs["tags"] = tags

    # Build openapi_extra for the 200 response example
    if response_example is not None:
        kwargs["openapi_extra"] = {
            "responses": {
                "200": {
                    "content": {
                        "application/json": {
                            "example": {
                                "success": True,
                                "data": response_example,
                                "message": "OK",
                                "credits_used": 1,
                                "request_id": "a1b2c3d4",
                            }
                        }
                    }
                }
            }
        }

    # Merge extra error responses
    if responses:
        kwargs["responses"] = responses

    return kwargs


# ══════════════════════════════════════════════════════════════
#  3. Tag metadata (shown in Swagger sidebar and Redoc nav)
# ══════════════════════════════════════════════════════════════

_TAG_METADATA = [
    {
        "name": "Resume",
        "description": "AI resume rewriting, parsing, version management, and PDF export. "
                       "All write operations cost **1 credit**.",
    },
    {
        "name": "ATS",
        "description": "Applicant Tracking System (ATS) compatibility scoring. "
                       "Includes standard score and X-Ray semantic sentence-level analysis.",
    },
    {
        "name": "X-Ray ATS",
        "description": "Deep semantic ATS analysis — scores each resume sentence individually "
                       "and flags weak, moderate, and strong bullets.",
    },
    {
        "name": "Job Match",
        "description": "Compare a resume against a job description to get a fit score "
                       "and gap analysis.",
    },
    {
        "name": "Interview Prep",
        "description": "Generate tailored technical and behavioral interview questions "
                       "from a resume and target role.",
    },
    {
        "name": "Interview Simulator",
        "description": "Full multi-turn mock interview: start session → submit answers → "
                       "receive feedback → generate final performance report.",
    },
    {
        "name": "Cover Letter",
        "description": "Generate and stream AI cover letters tuned to tone and hiring manager.",
    },
    {
        "name": "LinkedIn",
        "description": "Generate keyword-optimised LinkedIn headline, About section, and skill list.",
    },
    {
        "name": "Projects",
        "description": "Recommend portfolio projects that close the skill gap between "
                       "a resume and a target job.",
    },
    {
        "name": "Credits",
        "description": "Credit balance, transaction history, and purchase flow via Stripe.",
    },
    {
        "name": "Payments",
        "description": "Stripe checkout session creation and webhook processing.",
    },
    {
        "name": "Roadmap",
        "description": "AI career roadmap generator: milestones from current skills → target role.",
    },
    {
        "name": "Chat",
        "description": "Conversational career assistant with message history.",
    },
    {
        "name": "Stats",
        "description": "User dashboard stats: total analyses, scores, usage breakdown.",
    },
    {
        "name": "History",
        "description": "Paginated analysis history with full result replay.",
    },
    {
        "name": "Export",
        "description": "Export any analysis result to PDF.",
    },
    {
        "name": "Resume Parse",
        "description": "Extract plain text from uploaded PDF/DOCX without rewriting.",
    },
    {
        "name": "Job Scraper",
        "description": "Scrape and parse job description from a URL.",
    },
    {
        "name": "Learning Path",
        "description": "Personalised learning path and skill gap analysis.",
    },
    {
        "name": "Resume Versions",
        "description": "Save, list, and restore named resume versions.",
    },
    {
        "name": "Admin",
        "description": "Admin-only analytics and platform health. Requires `admin` role.",
    },
    {
        "name": "Tasks",
        "description": "Background task queue status polling.",
    },
    {
        "name": "Voice Interview",
        "description": "WebSocket-based real-time voice interview simulator.",
    },
    {
        "name": "Skill Tree",
        "description": "Gamified skill tree with XP, mastery levels, and learning resources.",
    },
    {
        "name": "Achievement Extractor",
        "description": "AI bullet-point enhancer — rewrites weak resume bullets with metrics.",
    },
    {
        "name": "User Context",
        "description": "Persist the user's active resume and job description across sessions.",
    },
    {
        "name": "LaTeX Resume",
        "description": "Generate a LaTeX-formatted resume from plain text or uploaded PDF.",
    },
    {
        "name": "Recruiter",
        "description": "Recruiter portal: post jobs, bulk-screen CVs, shortlist, and action candidates. "
                       "Requires `recruiter` role.",
    },
    {
        "name": "Job Board",
        "description": "Public job board for job seekers: browse listings, view details, and apply.",
    },
    {
        "name": "User Role",
        "description": "Set or query the authenticated user's platform role (student/recruiter).",
    },
    {
        "name": "Observability",
        "description": "Internal health and metrics endpoints. Not for public consumption.",
    },
]


# ══════════════════════════════════════════════════════════════
#  4. Long description (markdown rendered in Swagger/Redoc)
# ══════════════════════════════════════════════════════════════

_DESCRIPTION = """
## Overview
**Skillmate AI** is a full-stack career acceleration platform that uses Claude Opus,
Groq Llama, and Ollama to help job seekers land jobs faster.

## Authentication
All endpoints (except `/health`, `/metrics`, and the public job board) require a
**Supabase JWT** in the `Authorization: Bearer <token>` header.

Obtain a token from the Skillmate frontend or directly from the Supabase Auth REST API:
```
POST https://<project>.supabase.co/auth/v1/token?grant_type=password
```

## Credits
Most AI features consume **1 credit** per call. The current balance is returned in
every `SuccessResponse` as `credits_used`. Top up credits via the `/api/v1/payments`
endpoints.

| Feature                   | Credits |
|---------------------------|---------|
| ATS Score                 | 1       |
| Resume Rewrite            | 2       |
| Cover Letter              | 1       |
| Interview Prep Questions  | 1       |
| Career Roadmap            | 2       |
| Recruiter CV Screening    | 1 / CV  |

## Rate Limiting
`60 requests / minute` per IP address. Exceeding this returns `429 Too Many Requests`.

## Response Envelope
All successful responses are wrapped in:
```json
{
  "success": true,
  "data": { ... },
  "message": "OK",
  "credits_used": 1,
  "request_id": "a1b2c3d4"
}
```

## Error Envelope
All errors are wrapped in:
```json
{
  "success": false,
  "error_code": "INSUFFICIENT_CREDITS",
  "message": "Required: 2, Available: 0",
  "request_id": "a1b2c3d4"
}
```

## AI Provider Fallback Chain
`Claude Opus → Groq Llama 3.1 → Ollama (local)` — automatic, no client-side handling needed.
"""
