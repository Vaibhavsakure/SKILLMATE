"""
Skillmate Backend — Centralized Settings
==========================================
All environment variables flow through here via pydantic-settings.

Production Checklist:
  - Set SECRET_KEY to a strong random string (64+ chars)
  - Set ENV=production
  - Set DATABASE_URL to PostgreSQL
  - Set SUPABASE_URL and SUPABASE_ANON_KEY
  - Set CORS_ORIGINS to your actual frontend domain(s)
  - Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
  - Set S3_BUCKET_NAME + credentials to persist uploaded files
"""

import secrets
import logging
from typing import List, Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- General ---
    app_name: str = "Skillmate API"
    env: str = "development"  # "development" | "staging" | "production"
    debug: bool = False  # Safe default — only True when explicitly set

    # --- Security ---
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    cors_allow_headers: List[str] = [
        "Authorization", "Content-Type", "Accept", "Origin",
        "X-Requested-With", "X-Request-ID",
        "Content-Disposition", "Content-Length",
    ]
    secret_key: str = ""  # REQUIRED in production — auto-generated in dev
    frontend_url: str = "http://localhost:3000"  # Used for Stripe redirects, emails, etc.

    # --- Database (PostgreSQL or SQLite fallback) ---
    database_url: str = "sqlite:///./dev.db"

    # --- Supabase (Auth & Storage) ---
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    allow_dev_mock_auth: bool = False

    # --- AI Providers ---
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

    # --- Ollama (Local LLM — optional fallback) ---
    ollama_base_url: str = "http://localhost:11434"

    # --- File Upload ---
    max_file_size_mb: int = 10
    upload_dir: str = "/tmp/uploads"   # /tmp is writable in every container
    allowed_upload_extensions: List[str] = [".pdf", ".docx", ".doc"]

    # --- Cloud Storage (S3 / Cloudflare R2) ---
    # Recommended: Cloudflare R2 (S3-compatible, free egress, $0.015/GB storage)
    # AWS S3:    set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
    # R2:        also set AWS_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
    # Local dev: leave all blank → falls back to /tmp/uploads (lost on restart)
    s3_bucket_name: Optional[str] = None

    # Credentials — use IAM role in prod instead of hardcoded keys where possible
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None

    # Custom S3-compatible endpoint.
    # Accepts EITHER s3_endpoint_url OR aws_endpoint_url (boto3/R2 standard name).
    # aws_endpoint_url takes precedence if both are set.
    s3_endpoint_url: Optional[str] = None
    aws_endpoint_url: Optional[str] = None       # Standard boto3/R2 env var name

    s3_public_url: Optional[str] = None          # CDN / R2 custom domain (no trailing slash)
                                                  # e.g. https://files.skillmate.ai
    s3_region: str = "auto"                       # "auto" works for R2; use "us-east-1" for AWS

    @model_validator(mode="after")
    def _resolve_endpoint(self) -> "Settings":
        """Merge aws_endpoint_url → s3_endpoint_url so the rest of the code
        only needs to check s3_endpoint_url."""
        if self.aws_endpoint_url and not self.s3_endpoint_url:
            self.s3_endpoint_url = self.aws_endpoint_url
        return self

    @property
    def s3_is_configured(self) -> bool:
        """True when all three required S3 fields are present."""
        return bool(
            self.s3_bucket_name
            and self.aws_access_key_id
            and self.aws_secret_access_key
        )

    # --- Stripe Payments ---
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_publishable_key: Optional[str] = None

    # --- Monitoring (Sentry) ---
    sentry_dsn: Optional[str] = None  # e.g. https://...@sentry.io/...
    sentry_traces_sample_rate: float = 0.2   # 20% transaction tracing
    sentry_profiles_sample_rate: float = 0.1  # 10% profiling

    # --- Redis (Cache / Queue) ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Email (future) ---
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: str = "noreply@skillmate.ai"

    # --- Computed Properties ---
    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def is_development(self) -> bool:
        return self.env == "development"

    @property
    def is_staging(self) -> bool:
        return self.env == "staging"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )


# Create settings instance
settings = Settings()

# --- Startup Validation ---
_logger = logging.getLogger("skillmate.config")

# Auto-generate secret_key in development if not set
if not settings.secret_key:
    if settings.is_production:
        raise RuntimeError(
            "❌ FATAL: SECRET_KEY is required in production. "
            "Set it to a random string (64+ chars): python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    settings.secret_key = secrets.token_urlsafe(48)
    _logger.warning("⚠️ SECRET_KEY not set — auto-generated for development. Set SECRET_KEY in .env for production.")

# Warn about insecure defaults in production
if settings.is_production:
    if "sqlite" in settings.database_url:
        _logger.critical("❌ SQLite detected in production! Set DATABASE_URL to PostgreSQL.")
    if not settings.supabase_url:
        _logger.critical("❌ SUPABASE_URL not configured in production!")
    if not settings.stripe_webhook_secret:
        _logger.warning("⚠️ STRIPE_WEBHOOK_SECRET not set — webhooks will not be verified!")
    if settings.allow_dev_mock_auth:
        raise RuntimeError("❌ FATAL: ALLOW_DEV_MOCK_AUTH must be False in production!")
    if any(origin in settings.cors_origins for origin in ["http://localhost:3000", "http://127.0.0.1:3000"]):
        _logger.warning("⚠️ localhost CORS origin detected in production. Remove for security.")
    if not settings.s3_is_configured:
        _logger.warning(
            "⚠️ S3/R2 storage is NOT configured in production. "
            "Uploaded files will be saved to /tmp and LOST on container restart. "
            "Set S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (and "
            "AWS_ENDPOINT_URL for Cloudflare R2) to enable persistent cloud storage."
        )