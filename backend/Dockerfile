# ============================================================
# Skillmate AI Backend — Production Dockerfile
# ============================================================
# Multi-stage build:
#   Stage 1 (builder)  — Install Python deps in a venv
#   Stage 2 (runtime)  — Copy only the venv + app code
# ============================================================

# ── Stage 1: Builder ─────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# System dependencies for building wheels (psycopg2, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment so we can cleanly copy it
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies (layer-cached if requirements.txt unchanged)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.12-slim AS runtime

LABEL maintainer="Skillmate AI Team"
LABEL description="Skillmate AI FastAPI Backend"

# Runtime system dependencies (libpq for psycopg2, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the venv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid 1001 --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy application code
COPY --chown=appuser:appuser . .

# Create upload directory with correct ownership
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app/uploads

# Switch to non-root user
USER appuser

# Expose FastAPI port
EXPOSE 8000

# Health check — hits the /health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command: run Uvicorn with production settings
# --proxy-headers: trust X-Forwarded-For from reverse proxy
# --forwarded-allow-ips: accept forwarded headers from Docker network
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--workers", "4", \
     "--log-level", "info", \
     "--access-log"]
