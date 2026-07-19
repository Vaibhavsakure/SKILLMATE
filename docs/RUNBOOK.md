# Skillmate AI — Production Runbook v3.0.0

> **Last updated:** 2026-07-19  
> **Maintainer:** Platform Engineering  
> **Stack:** FastAPI · PostgreSQL 16 · Redis 7 · ARQ · Next.js · Docker Compose

---

## 1. Pre-Launch Checklist

Complete every item before cutting over DNS to the production deployment.

### Infrastructure

- [ ] Production VPS/VM provisioned (min 4 vCPU, 8 GB RAM, 100 GB SSD)
- [ ] Docker Engine ≥ 24.x and Docker Compose v2 installed
- [ ] Firewall rules: allow 80, 443 inbound; block 5432, 6379 from public
- [ ] SSL certificate provisioned (Let's Encrypt or Cloudflare origin cert)
- [ ] DNS A/AAAA records pointing to production IP
- [ ] Reverse proxy configured (Nginx/Caddy → `backend:8000`, `frontend:3000`)

### Environment Variables

- [ ] `.env.production` created from `.env.example` — **no defaults left blank**
- [ ] `SECRET_KEY` set to a unique 64-char random string
- [ ] `DATABASE_URL` pointing to production PostgreSQL (not `skillmate_dev_password`)
- [ ] `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `ANTHROPIC_API_KEY` and/or `GROQ_API_KEY` set (at least one AI provider)
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PUBLISHABLE_KEY` set
- [ ] `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `EMAIL_FROM` configured
- [ ] `S3_BUCKET_NAME` + `S3_ENDPOINT_URL` + `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` set
- [ ] `SENTRY_DSN` set for error tracking
- [ ] `FRONTEND_URL` set to production domain (e.g. `https://app.skillmate.ai`)

### Services & Integrations

- [ ] Stripe webhook endpoint registered: `https://api.skillmate.ai/api/v1/payments/webhook`
- [ ] Supabase project auth settings: redirect URLs updated to production domain
- [ ] Sentry project created, DSN verified with test event
- [ ] Database migration dry-run completed on staging (`alembic upgrade head`)
- [ ] Backup service verified: initial backup file exists and is >1 KB

---

## 2. Deploy Commands

Run these steps in order on the production host.

### 2.1 Pull latest code

```bash
cd /opt/skillmate
git fetch origin main
git log --oneline origin/main -5          # review commits
git pull origin main
```

### 2.2 Verify environment file

```bash
# Diff against example to catch missing keys
diff <(grep -oP '^[A-Z_]+' .env.example | sort) \
     <(grep -oP '^[A-Z_]+' .env.production | sort)
```

### 2.3 Build and start containers

```bash
# Build with no cache if dependencies changed, otherwise drop --no-cache
docker compose -f docker-compose.yml --env-file .env.production build --no-cache

# Start all services (detached)
docker compose -f docker-compose.yml --env-file .env.production up -d
```

### 2.4 Run database migrations

```bash
# Execute inside the running backend container
docker compose exec backend alembic upgrade head

# Verify current revision
docker compose exec backend alembic current
```

### 2.5 Verify ARQ worker is connected

```bash
docker compose logs worker --tail 20 | grep "ARQ worker started"
```

### 2.6 Verify backup service

```bash
docker compose logs backup --tail 10 | grep "Backup completed"
```

### 2.7 Healthcheck

```bash
# Backend health
curl -sf https://api.skillmate.ai/health | jq .

# Expected: {"status":"healthy","version":"3.0.0",...}

# Frontend
curl -sf -o /dev/null -w "%{http_code}" https://app.skillmate.ai
# Expected: 200

# Metrics endpoint
curl -sf https://api.skillmate.ai/metrics | jq '.ai_circuit_breakers'
# Expected: {"claude":"closed","groq":"closed","ollama":"closed"}

# Redis connectivity
docker compose exec redis redis-cli ping
# Expected: PONG

# PostgreSQL connectivity
docker compose exec postgres pg_isready -U skillmate
# Expected: accepting connections
```

### 2.8 Smoke test critical paths

```bash
# ATS Score (replace TOKEN with a valid Supabase JWT)
curl -sf -X POST https://api.skillmate.ai/api/v1/ats \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"resume_text":"Software Engineer with 5 years experience","jd_text":"Looking for a backend engineer"}' \
  | jq '.data.ats_score'

# Credit balance
curl -sf https://api.skillmate.ai/api/v1/credits/balance \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.credits'
```

### 2.9 Tag the release

```bash
git tag -a v3.0.0 -m "Production release v3.0.0"
git push origin v3.0.0
```

---

## 3. Rollback Procedure

### 3.1 Quick rollback — revert to previous image

```bash
# Find the previous image tag/SHA
docker compose images | grep backend

# Stop current deployment
docker compose down

# Checkout the previous release tag
git checkout v2.x.x   # replace with the last known-good tag

# Rebuild and start
docker compose -f docker-compose.yml --env-file .env.production up -d --build
```

### 3.2 Rollback database migration

```bash
# List migration history
docker compose exec backend alembic history --verbose

# Downgrade to the previous revision (replace with actual revision ID)
docker compose exec backend alembic downgrade -1

# Or downgrade to a specific revision
docker compose exec backend alembic downgrade d4e5f6a7b8c9

# Verify
docker compose exec backend alembic current
```

### 3.3 Emergency: restore database from backup

```bash
# List available backups
docker compose exec backup ls -lh /backups/

# Restore (interactive — will prompt for confirmation)
docker compose exec -it backup /scripts/restore.sh skillmate_2026-07-19_02-00.sql.gz
```

### 3.4 Post-rollback verification

```bash
# Run the same healthcheck battery from section 2.7
curl -sf https://api.skillmate.ai/health | jq .

# Verify the correct alembic revision is active
docker compose exec backend alembic current

# Check error rate in Sentry for the last 10 minutes
# (manual — open Sentry dashboard)
```

---

## 4. Incident Response

### 4.1 Database Down

**Symptom:** HTTP 500 on all endpoints. Backend logs show `sqlalchemy.exc.OperationalError: could not connect to server`.

```bash
# CHECK: Is the container running?
docker compose ps postgres
docker compose logs postgres --tail 30

# CHECK: Can we connect manually?
docker compose exec postgres pg_isready -U skillmate

# CHECK: Disk space
docker compose exec postgres df -h /var/lib/postgresql/data

# FIX: Restart the container
docker compose restart postgres

# FIX: If volume is corrupted — restore from backup
docker compose down postgres
docker volume rm skillmate_postgres_data
docker compose up -d postgres
# Wait for healthcheck, then restore:
docker compose exec -it backup /scripts/restore.sh <latest_backup_file>
# Re-run migrations:
docker compose exec backend alembic upgrade head
```

---

### 4.2 All AI Providers Failing

**Symptom:** ATS/rewrite/roadmap endpoints return 500 or empty results. Metrics show all circuit breakers `"open"`.

```bash
# CHECK: Circuit breaker states
curl -sf https://api.skillmate.ai/metrics | jq '.ai_circuit_breakers'

# CHECK: API key validity (Claude)
curl -sf https://api.anthropic.com/v1/messages \
  -H "x-api-key: ${ANTHROPIC_API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}' \
  | jq '.content[0].text'

# CHECK: API key validity (Groq)
curl -sf https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer ${GROQ_API_KEY}" \
  | jq '.data | length'

# CHECK: Backend logs for provider errors
docker compose logs backend --tail 100 | grep -i "circuit\|provider\|anthropic\|groq"

# FIX: If keys rotated — update .env.production and restart
docker compose restart backend worker

# FIX: If upstream outage — wait for recovery. Circuit breakers auto-reset
# after 30s (HALF_OPEN → test one request → CLOSED if successful).
# Monitor with:
watch -n 10 'curl -sf https://api.skillmate.ai/metrics | jq .ai_circuit_breakers'
```

---

### 4.3 Stripe Webhook Failing

**Symptom:** Customers pay but credits don't appear. Stripe dashboard shows webhook delivery failures (HTTP 4xx/5xx).

```bash
# CHECK: Stripe webhook logs (Stripe CLI)
stripe listen --log-level debug
stripe events list --limit 5

# CHECK: Is the webhook endpoint reachable?
curl -sf -o /dev/null -w "%{http_code}" \
  -X POST https://api.skillmate.ai/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 (bad signature) — NOT 404 or 502

# CHECK: Backend logs for webhook errors
docker compose logs backend --tail 50 | grep -i "stripe\|webhook\|payment"

# FIX: Verify webhook secret matches
grep STRIPE_WEBHOOK_SECRET .env.production

# FIX: Re-register webhook in Stripe dashboard
# → Developers → Webhooks → Update endpoint URL
# → Ensure events: checkout.session.completed, invoice.payment_succeeded

# FIX: Manually grant credits for failed webhooks
docker compose exec backend python -c "
from app.core.database import SessionLocal
from app.services.credit_service import add_credits
db = SessionLocal()
add_credits(db, 'USER_ID_HERE', 100, 'manual: stripe webhook recovery')
db.close()
print('Credits added.')
"
```

---

### 4.4 High Error Rate (>5%)

**Symptom:** Sentry alert fires. Metrics endpoint shows elevated error count. Users report intermittent failures.

```bash
# CHECK: Current error metrics
curl -sf https://api.skillmate.ai/metrics | jq '{
  total_requests: .total_requests,
  errors_total: .errors_total,
  error_pct: ((.errors_total / .total_requests) * 100)
}'

# CHECK: Most frequent errors in last 100 log lines
docker compose logs backend --tail 500 | grep -i "error\|exception\|traceback" | \
  sort | uniq -c | sort -rn | head -10

# CHECK: Container resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | \
  grep skillmate

# CHECK: PostgreSQL active connections (max is typically 100)
docker compose exec postgres psql -U skillmate -d skillmate -c \
  "SELECT count(*) as active, max_conn FROM pg_stat_activity, 
   (SELECT setting::int as max_conn FROM pg_settings WHERE name='max_connections') s 
   GROUP BY max_conn;"

# FIX: If memory pressure — restart the heaviest container
docker compose restart backend

# FIX: If connection pool exhaustion — increase pool size
# Edit backend Dockerfile or env: SQLALCHEMY_POOL_SIZE=20

# FIX: If specific endpoint failing — check Sentry for stack trace
# and deploy a hotfix:
git cherry-pick <fix-commit>
docker compose up -d --build backend
```

---

### 4.5 Redis Down

**Symptom:** Cache misses on every request (slower responses). ARQ worker disconnects. Tasks not being processed.

```bash
# CHECK: Is the container running?
docker compose ps redis
docker compose logs redis --tail 20

# CHECK: Can we connect?
docker compose exec redis redis-cli ping

# CHECK: Memory usage
docker compose exec redis redis-cli info memory | grep used_memory_human

# CHECK: Are keys present?
docker compose exec redis redis-cli dbsize

# FIX: Restart Redis
docker compose restart redis

# FIX: If data dir corrupted — flush and restart
docker compose exec redis redis-cli FLUSHALL
docker compose restart redis

# FIX: Restart the worker (to re-establish ARQ connection)
docker compose restart worker

# VERIFY: Worker reconnected
docker compose logs worker --tail 10 | grep "ARQ worker started"

# VERIFY: Cache warming — hit a few endpoints
curl -sf https://api.skillmate.ai/health | jq .
```

---

## 5. Monitoring Links

| Service | URL | Notes |
|---|---|---|
| **Sentry** | `https://sentry.io/organizations/<ORG>/projects/skillmate/` | Error tracking, alerts |
| **Application Logs** | `https://<LOG_PROVIDER>/skillmate-backend` | Structured JSON logs |
| **Metrics Endpoint** | `https://api.skillmate.ai/metrics` | Circuit breakers, request counts, latency |
| **Health Endpoint** | `https://api.skillmate.ai/health` | Quick status check |
| **Stripe Dashboard** | `https://dashboard.stripe.com/webhooks` | Webhook delivery status |
| **Supabase Dashboard** | `https://supabase.com/dashboard/project/<PROJECT_REF>` | Auth, DB explorer |
| **Docker Logs** | SSH → `docker compose logs -f --tail 100` | Real-time container logs |
| **Uptime Monitor** | `https://<UPTIME_PROVIDER>/skillmate` | External availability |
| **k6 Load Test Results** | `./tests/load/README.md` | Run on demand |

### Quick-access log commands

```bash
# All services, last 5 minutes
docker compose logs --since 5m

# Backend only, follow mode
docker compose logs -f backend

# Filter for errors only
docker compose logs backend 2>&1 | grep -E "ERROR|CRITICAL|Traceback"

# Worker job completions
docker compose logs worker 2>&1 | grep "\[job\]"

# Backup results
docker compose logs backup 2>&1 | grep "\[backup\]"
```

---

## 6. On-Call Escalation

### Escalation Matrix

| Level | Role | Contact | Responds within |
|---|---|---|---|
| **L1** | On-call engineer | `<NAME>` · `<PHONE>` · `<SLACK_HANDLE>` | 15 min |
| **L2** | Backend lead | `<NAME>` · `<PHONE>` · `<SLACK_HANDLE>` | 30 min |
| **L3** | Platform / DevOps | `<NAME>` · `<PHONE>` · `<SLACK_HANDLE>` | 1 hour |
| **L4** | CTO / Founder | `<NAME>` · `<PHONE>` · `<SLACK_HANDLE>` | 2 hours |

### When to Escalate

| Condition | Escalate to |
|---|---|
| Single endpoint 5xx for >5 min | L1 |
| All AI providers down (circuit breakers open) | L1 → L2 if not resolved in 15 min |
| Database unreachable | L1 → L2 immediately |
| Payment processing failure (Stripe) | L1 → L2 immediately |
| Complete service outage (health endpoint down) | L1 → L2 → L3 within 10 min |
| Data breach or security incident | L1 → L3 → L4 immediately |

### Incident Communication Template

Post in **#incidents** Slack channel:

```
🚨 INCIDENT — [Severity: SEV1/SEV2/SEV3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Impact:     [What users are experiencing]
Started:    [HH:MM UTC]
Status:     [Investigating / Identified / Mitigating / Resolved]
On-call:    [Name]
Sentry:     [Link to issue]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Updates will follow every 15 min until resolved.
```

### Post-Incident

1. Update incident thread with resolution details
2. Write a blameless post-mortem within 48 hours
3. File follow-up tickets for preventive measures
4. Update this runbook if the incident revealed a gap

---

## Appendix: Quick Reference

### Container names

| Service | Container | Port |
|---|---|---|
| PostgreSQL | `skillmate-postgres` | 5432 |
| Redis | `skillmate-redis` | 6379 |
| Backend API | `skillmate-backend` | 8000 |
| ARQ Worker | `skillmate-worker` | — |
| Backup Cron | `skillmate-backup` | — |
| Frontend | `skillmate-frontend` | 3000 |

### File locations inside containers

| Path | Contents |
|---|---|
| `/app/` | Backend application code |
| `/app/uploads/` | User-uploaded resumes (legacy, migrating to S3) |
| `/backups/` | pg_dump gzipped backups (backup container) |
| `/scripts/` | backup.sh, restore.sh (mounted read-only) |

### Useful aliases

```bash
# Add to ~/.bashrc on the production host
alias sk-logs='docker compose logs -f --tail 100'
alias sk-health='curl -sf http://localhost:8000/health | jq .'
alias sk-metrics='curl -sf http://localhost:8000/metrics | jq .'
alias sk-breakers='curl -sf http://localhost:8000/metrics | jq .ai_circuit_breakers'
alias sk-restart='docker compose restart backend worker'
alias sk-backup='docker compose exec backup /scripts/backup.sh'
alias sk-psql='docker compose exec postgres psql -U skillmate -d skillmate'
alias sk-redis='docker compose exec redis redis-cli'
```
