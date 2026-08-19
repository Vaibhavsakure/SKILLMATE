"""
Skillmate Backend ΓÇö Centralized Settings
==========================================
All environment variables flow through here via pydantic-settings.

Production Checklist:
  - Set SECRET_KEY to a strong random string (64+ chars)
  - Set ENV=production
  - Set DATABASE_URL to PostgreSQL
  - Set SUPABASE_URL and SUPABASE_ANON_KEY
  - Set CORS_ORIGINS to your actual frontend domain(s)
  - Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
"""

import secrets
import logging
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- General ---
    app_name: str = "Skillmate API"
    env: str = "development"  # "development" | "staging" | "production"
    debug: bool = False  # Safe default ΓÇö only True when explicitly set

    # --- Security ---
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    cors_allow_headers: List[str] = [
        "Authorization", "Content-Type", "Accept", "Origin",
        "X-Requested-With", "X-Request-ID",
    ]
    secret_key: str = ""  # REQUIRED in production ΓÇö auto-generated in dev
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
    anthropic_model: str = "claude-3-5-haiku-20241022"
    groq_api_key: Optional[str] = None
    groq_model: str = "openai/gpt-oss-120b"
    gemini_api_key: Optional[str] = None

    # --- Ollama (Local LLM ΓÇö optional fallback) ---
    ollama_base_url: str = "http://localhost:11434"

    # --- Redis (response cache + ARQ task queue) ---
    # Docker Compose sets REDIS_URL=redis://redis:6379/0.
    # Local dev without Docker falls back to localhost.
    redis_url: str = "redis://localhost:6379/0"

    # --- File Upload ---
    max_file_size_mb: int = 10
    upload_dir: str = "uploads"
    # Extensions accepted by the upload validator. Keep in sync with
    # app.core.security.FILE_SIGNATURES and app.utils.file_parser.
    allowed_upload_extensions: List[str] = [".pdf", ".docx", ".doc", ".txt"]

    # --- Admin ---
    # Comma-separated list of user IDs or emails allowed to read /admin/*.
    # Empty in production means the admin endpoints are closed to everyone.
    admin_user_ids: List[str] = []
    # Protect /metrics with a shared secret sent as the X-Metrics-Token header.
    metrics_token: Optional[str] = None

    # --- Cloud Storage (S3 / Cloudflare R2) ---
    # Leave blank to keep using local uploads/ directory (development default).
    # For AWS S3: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME.
    # For Cloudflare R2: also set S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
    s3_bucket_name: Optional[str] = None
    s3_endpoint_url: Optional[str] = None        # Custom endpoint for R2/MinIO/Backblaze
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    s3_public_url: Optional[str] = None          # CDN / R2 custom domain (no trailing slash)
                                                  # e.g. https://files.skillmate.ai

    # --- Stripe Payments ---
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_publishable_key: Optional[str] = None

    # --- Monitoring (Sentry) ---
    sentry_dsn: Optional[str] = None  # e.g. https://...@sentry.io/...
    sentry_traces_sample_rate: float = 0.2   # 20% transaction tracing
    sentry_profiles_sample_rate: float = 0.1  # 10% profiling

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
            "Γ¥î FATAL: SECRET_KEY is required in production. "
            "Set it to a random string (64+ chars): python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    settings.secret_key = secrets.token_urlsafe(48)
    _logger.warning("ΓÜá∩╕Å SECRET_KEY not set ΓÇö auto-generated for development. Set SECRET_KEY in .env for production.")

# Warn about insecure defaults in production
if settings.is_production:
    if "sqlite" in settings.database_url:
        _logger.critical("Γ¥î SQLite detected in production! Set DATABASE_URL to PostgreSQL.")
    if not settings.supabase_url:
        _logger.critical("Γ¥î SUPABASE_URL not configured in production!")
    if not settings.stripe_webhook_secret:
        _logger.warning("ΓÜá∩╕Å STRIPE_WEBHOOK_SECRET not set ΓÇö webhooks will not be verified!")
    if settings.allow_dev_mock_auth:
        raise RuntimeError("Γ¥î FATAL: ALLOW_DEV_MOCK_AUTH must be False in production!")
    if any(origin in settings.cors_origins for origin in ["http://localhost:3000", "http://127.0.0.1:3000"]):
        _logger.warning("ΓÜá∩╕Å localhost CORS origin detected in production. Remove for security.")
