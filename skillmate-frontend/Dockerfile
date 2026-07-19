# ============================================================
# Skillmate AI Frontend — Production Dockerfile
# ============================================================
# Multi-stage build:
#   Stage 1 (deps)     — Install node_modules
#   Stage 2 (builder)  — Build Next.js standalone output
#   Stage 3 (runner)   — Minimal runtime with standalone server
# ============================================================

# ── Stage 1: Install Dependencies ────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package manifests only (for layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build Application ───────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments — injected at build time for NEXT_PUBLIC_* vars
# These get baked into the client JS bundle during `next build`
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_BASE_URL=/api/python
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application (standalone output)
RUN npm run build

# ── Stage 3: Production Runner ───────────────────────────────
FROM node:20-alpine AS runner

LABEL maintainer="Skillmate AI Team"
LABEL description="Skillmate AI Next.js Frontend"

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy static assets (public folder)
COPY --from=builder /app/public ./public

# Copy standalone output — Next.js creates this with `output: 'standalone'`
# in next.config.ts. This is a self-contained Node.js server.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose Next.js port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the standalone Next.js server
CMD ["node", "server.js"]
