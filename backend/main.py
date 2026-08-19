"""
Skillmate AI Backend ΓÇö Main Application
=========================================
"""

import time
import secrets
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.security import SecurityHeadersMiddleware, RequestIDMiddleware

# ΓöÇΓöÇ Monitoring: configure logging FIRST, before any other imports ΓöÇΓöÇ
from app.core.logger import configure_logging, get_logger, RequestLoggingMiddleware
from app.core.monitoring import init_sentry, get_metrics
from app.core.docs import configure_openapi

configure_logging(
    environment=settings.env,
    release="skillmate@3.0.0",
    log_level="DEBUG" if settings.debug else "INFO",
)

# Import Routers
from app.api import (
    resume_rewrite,
    ats_score,
    job_match,
    interview_prep,
    cover_letter,
    linkedin,
    project_recommendations,
    credits,
    career_roadmap,
    chat,
    stats,
    history,
    export,
    resume_parse,
    job_scraper,
    interview_simulator,
    learning_path,
    resume_versions,
    payments,
    admin,
    tasks,
    voice_interview,
    xray_ats,
    skill_tree,
    achievement_extractor,
    user_context,
    latex_resume,
    recruiter,
    job_board,
    user_role,
)

logger = get_logger("skillmate.main")

# --- Configuration ---
TITLE = "Skillmate AI Backend"
VERSION = "3.0.0"

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ΓöÇΓöÇ Sentry: init before anything else that could raise ΓöÇΓöÇ
    _sentry_dsn = getattr(settings, "sentry_dsn", None) or ""
    _sentry_ok = init_sentry(
        dsn=_sentry_dsn,
        env=settings.env,
        release="skillmate@3.0.0",
    )

    logger.info(
        "Skillmate AI Engine starting",
        extra={
            "environment": settings.env,
            "database": "postgresql" if "postgresql" in settings.database_url else "sqlite",
            "claude_configured": bool(settings.anthropic_api_key),
            "supabase_configured": bool(settings.supabase_url),
            "sentry_enabled": _sentry_ok,
        },
    )

    # Initialize Database Tables
    try:
        from app.core.database import engine, Base
        # Importing app.db.base registers every model on Base.metadata, so
        # create_all() and Alembic autogenerate see the same set of tables.
        import app.db.base  # noqa: F401

        logger.info("Checking database tables")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified")
    except Exception as e:
        logger.warning(f"Database init warning: {e}", exc_info=True)

    yield
    logger.info("Skillmate AI Engine shutting down")


app = FastAPI(title=TITLE, version=VERSION, lifespan=lifespan)

# Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Security Middlewares (order matters: last added = first executed) ---
# 1. CORS ΓÇö explicit origins, methods, and headers (no wildcards)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
    expose_headers=["X-Process-Time", "X-Request-ID"],
)

# 2. Security Headers (CSP, X-Frame-Options, HSTS, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# 3. Request ID Tracking (for log correlation)
app.add_middleware(RequestIDMiddleware)

# 4. Structured JSON request logging + metrics counter
app.add_middleware(RequestLoggingMiddleware)


# --- Register Routers ---

# 1. Resume Rewriter
app.include_router(
    resume_rewrite.router,
    prefix="/api/v1/resume",
    tags=["Resume"],
)

# 2. ATS Scanner
app.include_router(
    ats_score.router,
    prefix="/api/v1/ats",
    tags=["ATS"],
)

# 3. Job Match
app.include_router(
    job_match.router,
    prefix="/api/v1/jobs",
    tags=["Job Match"],
)

# 4. Interview Prep
app.include_router(
    interview_prep.router,
    prefix="/api/v1/interview",
    tags=["Interview Prep"],
)

# 5. Cover Letter
app.include_router(
    cover_letter.router,
    prefix="/api/v1/cover-letter",
    tags=["Cover Letter"],
)

# 6. LinkedIn Optimization (router already has /linkedin prefix)
app.include_router(
    linkedin.router,
    prefix="/api/v1",
    tags=["LinkedIn"],
)

# 7. Project Recommendations
app.include_router(
    project_recommendations.router,
    prefix="/api/v1/projects",
    tags=["Projects"],
)

# 8. Credits
app.include_router(
    credits.router,
    prefix="/api/v1/credits",
    tags=["Credits"],
)

# 9. Career Roadmap
app.include_router(
    career_roadmap.router,
    prefix="/api/v1/roadmap",
    tags=["Roadmap"],
)

# 10. AI Chatbot
app.include_router(
    chat.router,
    prefix="/api/v1/chat",
    tags=["Chat"],
)

# 11. Dashboard Stats
app.include_router(
    stats.router,
    prefix="/api/v1/stats",
    tags=["Stats"],
)

# 12. Analysis History
app.include_router(
    history.router,
    prefix="/api/v1/history",
    tags=["History"],
)

# 13. PDF Export
app.include_router(
    export.router,
    prefix="/api/v1/export",
    tags=["Export"],
)

# 14. Resume Parse (file upload ΓåÆ text extraction only)
app.include_router(
    resume_parse.router,
    prefix="/api/v1/resume",
    tags=["Resume Parse"],
)

# 15. Job Description Scraper
app.include_router(
    job_scraper.router,
    prefix="/api/v1/jobs",
    tags=["Job Scraper"],
)

# 16. Interview Simulator
app.include_router(
    interview_simulator.router,
    prefix="/api/v1/interview",
    tags=["Interview Simulator"],
)

# 17. Learning Path / Skill Gap
app.include_router(
    learning_path.router,
    prefix="/api/v1/learning",
    tags=["Learning Path"],
)

# 18. Resume Versions
app.include_router(
    resume_versions.router,
    prefix="/api/v1/resume",
    tags=["Resume Versions"],
)

# 19. Payments (Stripe)
app.include_router(
    payments.router,
    prefix="/api/v1/payments",
    tags=["Payments"],
)

# 20. Admin Analytics
app.include_router(
    admin.router,
    prefix="/api/v1/admin",
    tags=["Admin"],
)

# 21. Background Tasks
app.include_router(
    tasks.router,
    prefix="/api/v1/tasks",
    tags=["Tasks"],
)

# 22. Voice Interview Simulator (WebSocket)
app.include_router(
    voice_interview.router,
    tags=["Voice Interview"],
)

# 23. X-Ray ATS Semantic Analyzer
app.include_router(
    xray_ats.router,
    prefix="/api/v1/ats",
    tags=["X-Ray ATS"],
)

# 24. Gamified Skill Tree
app.include_router(
    skill_tree.router,
    prefix="/api/v1/skill-tree",
    tags=["Skill Tree"],
)

# 25. AI Achievement Extractor
app.include_router(
    achievement_extractor.router,
    prefix="/api/v1/resume",
    tags=["Achievement Extractor"],
)

# 26. Global User Context (Resume + JD)
app.include_router(
    user_context.router,
    prefix="/api/v1/context",
    tags=["User Context"],
)

# 27. LaTeX Resume Builder
app.include_router(
    latex_resume.router,
    prefix="/api/v1/latex-resume",
    tags=["LaTeX Resume"],
)

# 28. Recruiter Portal (HR / Recruiters)
app.include_router(
    recruiter.router,
    prefix="/api/v1/recruiter",
    tags=["Recruiter"],
)

# 29. Job Board (Job Seekers)
app.include_router(
    job_board.router,
    prefix="/api/v1/jobs",
    tags=["Job Board"],
)

# 30. User Role Management
app.include_router(
    user_role.router,
    prefix="/api/v1/users",
    tags=["User Role"],
)


# ΓöÇΓöÇ OpenAPI / Swagger documentation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
# Must be called AFTER all routers are registered.
configure_openapi(app)


# --- Metrics Endpoint ---
@app.get("/metrics", tags=["Observability"])
def metrics_endpoint(request: Request):
    """
    Returns live in-process metrics as JSON.
    Consumed by the /admin/health frontend dashboard.

    In production this requires the METRICS_TOKEN shared secret in the
    X-Metrics-Token header. Left open in development for convenience.
    """
    if settings.is_production:
        expected = settings.metrics_token
        if not expected:
            raise HTTPException(
                status_code=503,
                detail="Metrics endpoint is disabled: METRICS_TOKEN is not configured.",
            )
        provided = request.headers.get("X-Metrics-Token", "")
        # Constant-time compare so the token can't be recovered byte by byte.
        if not secrets.compare_digest(provided, expected):
            raise HTTPException(status_code=403, detail="Invalid metrics token.")

    return get_metrics()


# --- Root ---
@app.get("/")
def read_root():
    return {
        "status": "Online",
        "message": "Skillmate Backend Active",
        "version": VERSION,
    }


@app.get("/health")
def health_check():
    """
    Deep health check ΓÇö verifies actual connectivity to all services.
    Returns 200 if all critical services are healthy, 503 if any critical service is down.
    """
    from fastapi.responses import JSONResponse
    from app.core.database import SessionLocal
    from sqlalchemy import text

    health = {
        "status": "healthy",
        "version": VERSION,
        "environment": settings.env,
        "services": {},
    }
    is_healthy = True

    # 1. Database connectivity
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health["services"]["database"] = {
            "status": "connected",
            "type": "postgresql" if "postgresql" in settings.database_url else "sqlite",
        }
    except Exception as e:
        health["services"]["database"] = {"status": "error", "detail": str(e)}
        is_healthy = False

    # 2. AI providers availability
    health["services"]["ai"] = {
        "claude": "configured" if settings.anthropic_api_key else "not_configured",
        "groq": "configured" if settings.groq_api_key else "not_configured",
        "ollama": "configured",
    }

    # 3. Auth service
    health["services"]["auth"] = {
        "supabase": "configured" if settings.supabase_url else "not_configured",
    }

    # 4. Payments
    health["services"]["payments"] = {
        "stripe": "configured" if settings.stripe_secret_key else "not_configured",
    }

    if not is_healthy:
        health["status"] = "degraded"
        return JSONResponse(content=health, status_code=503)

    return health
