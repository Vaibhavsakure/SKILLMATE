# Skillmate AI — Deployment Guide

This document explains how to configure GitHub Actions CI/CD for automated testing and deployment.

---

## Workflow Overview

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | `.github/workflows/ci.yml` | Push/PR to `main` | Lint, test, build, deploy |
| **Manual Deploy** | `.github/workflows/deploy.yml` | Manual (GitHub UI) | Emergency deploys & rollbacks |
| **Backup Test** | `.github/workflows/backup-test.yml` | Weekly (Sunday 3am) | Verify backup scripts |

### CI Pipeline Flow

```
Push to main
  │
  ├─ backend-checks (parallel)
  │   ├─ pip install
  │   ├─ ruff lint
  │   └─ pytest
  │
  ├─ frontend-checks (parallel)
  │   ├─ npm ci
  │   ├─ eslint
  │   ├─ tsc --noEmit
  │   └─ next build
  │
  ├─ docker-build (after both checks pass, main only)
  │   ├─ Build backend image → ghcr.io
  │   └─ Build frontend image → ghcr.io
  │
  └─ deploy (after docker-build, main only)
      ├─ SSH into server
      ├─ docker compose pull
      ├─ docker compose up -d --no-deps backend frontend
      ├─ alembic upgrade head
      └─ Health check verification
```

---

## Required GitHub Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

### 🔐 Deployment Secrets (Required for deploy jobs)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SERVER_HOST` | Production server IP or hostname | `143.198.xxx.xxx` or `skillmate.ai` |
| `SERVER_USER` | SSH username on the server | `ubuntu` |
| `SSH_PRIVATE_KEY` | Private SSH key (entire file contents) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### 🔑 Application Secrets (Required for builds)

| Secret Name | Description | Where to get it |
|-------------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Settings → API |

### 📋 Optional Secrets

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_URL` | Backend Supabase URL (if different from frontend) |
| `SUPABASE_ANON_KEY` | Backend Supabase key |
| `ANTHROPIC_API_KEY` | For running AI-dependent tests |
| `GROQ_API_KEY` | For Groq fallback tests |
| `STRIPE_SECRET_KEY` | For payment integration tests |

---

## How to Set Up SSH Keys

### 1. Generate a deploy key (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/skillmate_deploy -N ""
```

### 2. Add the public key to your server

```bash
# Copy public key to server
ssh-copy-id -i ~/.ssh/skillmate_deploy.pub ubuntu@YOUR_SERVER_IP

# Or manually:
cat ~/.ssh/skillmate_deploy.pub | ssh ubuntu@YOUR_SERVER_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Add the private key to GitHub Secrets

```bash
# Copy the ENTIRE private key contents
cat ~/.ssh/skillmate_deploy
```

Paste the output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) into the `SSH_PRIVATE_KEY` secret.

---

## Server Setup (One-Time)

On your production server, set up the project directory:

```bash
# 1. Create project directory
sudo mkdir -p /opt/skillmate
sudo chown ubuntu:ubuntu /opt/skillmate

# 2. Clone the repository
cd /opt/skillmate
git clone https://github.com/YOUR_USER/skillmate.git .

# 3. Create production .env
cp .env.example .env
nano .env  # Fill in production values

# 4. Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# 5. Log in to GitHub Container Registry
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 6. Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 7. Set up SSL (optional — uses Let's Encrypt)
./scripts/setup_ssl.sh your-domain.com
```

---

## Manual Deploy & Rollback

### Deploy latest images

1. Go to **Actions** → **Manual Deploy** → **Run workflow**
2. Select `deploy-latest`
3. Choose services: `backend frontend`
4. Click **Run workflow**

### Deploy a specific version

1. Find the image tag from a previous CI run (e.g., `sha-abc1234`)
2. Go to **Actions** → **Manual Deploy** → **Run workflow**
3. Select `deploy-specific-tag`
4. Enter the tag: `sha-abc1234`
5. Click **Run workflow**

### Rollback

1. Go to **Actions** → **Manual Deploy** → **Run workflow**
2. Select `rollback`
3. Enter the previous working tag in `rollback_tag` (e.g., `sha-def5678`)
4. Click **Run workflow**

> **Tip:** If a deploy fails, the `deploy.yml` workflow automatically attempts a rollback. Check the workflow logs for details.

### Check server status

1. Go to **Actions** → **Manual Deploy** → **Run workflow**
2. Select `status-check`
3. Click **Run workflow** — this only checks health, doesn't deploy anything

---

## Troubleshooting

### Build fails on frontend

```
Type error: Property 'X' does not exist on type 'Y'
```

Fix: Run `npx tsc --noEmit` locally to see all type errors, then fix them before pushing.

### Deploy SSH fails

```
Permission denied (publickey)
```

1. Verify `SSH_PRIVATE_KEY` secret contains the full key (including headers)
2. Verify the matching public key is in `~/.ssh/authorized_keys` on the server
3. Test locally: `ssh -i ~/.ssh/skillmate_deploy ubuntu@YOUR_SERVER`

### Health check fails after deploy

```
❌ Backend health check failed after 60 seconds
```

1. SSH into server: `ssh ubuntu@YOUR_SERVER`
2. Check logs: `cd /opt/skillmate && docker compose logs --tail=50 backend`
3. Common causes: missing env vars, database migration failure, port conflict

### Docker image not found

```
Error: manifest unknown
```

The image hasn't been pushed yet. Either:
- Run the CI pipeline first (push to `main`)
- Or build & push manually:
  ```bash
  docker build -t ghcr.io/YOUR_USER/skillmate-backend:latest ./backend
  docker push ghcr.io/YOUR_USER/skillmate-backend:latest
  ```
