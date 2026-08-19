# ============================================================
# Skillmate AI — Makefile
# ============================================================
# Quick commands for Docker-based development & deployment.
#
# Usage:
#   make dev        → Start all services in development mode
#   make prod       → Start all services in production mode
#   make migrate    → Run Alembic migrations inside the backend container
#   make logs       → Tail logs from all services
#   make down       → Stop all services
#   make clean      → Stop services and remove volumes
# ============================================================

# Docker Compose files
COMPOSE_DEV  = docker compose -f docker-compose.yml
COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

# Default target
.DEFAULT_GOAL := help

# ── Development ──────────────────────────────────────────────

.PHONY: dev
dev: ## Start all services in development mode
	$(COMPOSE_DEV) up --build -d
	@echo ""
	@echo "✅ Skillmate AI is running!"
	@echo "   Frontend : http://localhost:3000"
	@echo "   Backend  : http://localhost:8000"
	@echo "   API Docs : http://localhost:8000/docs"
	@echo "   Health   : http://localhost:8000/health"
	@echo ""

.PHONY: dev-attached
dev-attached: ## Start all services (attached — logs stream to terminal)
	$(COMPOSE_DEV) up --build

# ── Production ───────────────────────────────────────────────

.PHONY: prod
prod: ## Start all services in production mode
	$(COMPOSE_PROD) up --build -d
	@echo ""
	@echo "✅ Skillmate AI PRODUCTION is running!"
	@echo ""

.PHONY: prod-pull
prod-pull: ## Pull latest images and restart production
	$(COMPOSE_PROD) pull
	$(COMPOSE_PROD) up -d

.PHONY: deploy-prod
deploy-prod: ## 🚀 One-liner production deploy (build + migrate + up)
	@echo ""
	@echo "🚀 Deploying Skillmate AI to production..."
	@echo ""
	$(COMPOSE_PROD) build
	$(COMPOSE_PROD) up -d postgres redis
	@echo "⏳ Waiting for database to be ready..."
	@sleep 5
	$(COMPOSE_PROD) run --rm backend alembic upgrade head
	$(COMPOSE_PROD) up -d
	@echo ""
	@echo "✅ Skillmate AI PRODUCTION deployed!"
	@echo "   https://yourdomain.com"
	@echo ""

.PHONY: ssl-setup
ssl-setup: ## 🔐 Obtain SSL certificates via Let's Encrypt
	sudo bash scripts/setup_ssl.sh

# ── Database & Migrations ────────────────────────────────────

.PHONY: migrate
migrate: ## Run Alembic migrations (upgrade head)
	$(COMPOSE_DEV) exec backend alembic upgrade head
	@echo "✅ Migrations applied."

.PHONY: migrate-create
migrate-create: ## Create a new migration (usage: make migrate-create MSG="add_users_table")
	$(COMPOSE_DEV) exec backend alembic revision --autogenerate -m "$(MSG)"
	@echo "✅ Migration created. Review it in backend/alembic/versions/"

.PHONY: migrate-downgrade
migrate-downgrade: ## Rollback one migration
	$(COMPOSE_DEV) exec backend alembic downgrade -1
	@echo "✅ Rolled back one migration."

.PHONY: migrate-history
migrate-history: ## Show migration history
	$(COMPOSE_DEV) exec backend alembic history

.PHONY: db-shell
db-shell: ## Open a psql shell in the postgres container
	$(COMPOSE_DEV) exec postgres psql -U skillmate -d skillmate

# ── Logs ─────────────────────────────────────────────────────

.PHONY: logs
logs: ## Tail logs from all services
	$(COMPOSE_DEV) logs -f --tail=100

.PHONY: logs-backend
logs-backend: ## Tail backend logs only
	$(COMPOSE_DEV) logs -f --tail=100 backend

.PHONY: logs-frontend
logs-frontend: ## Tail frontend logs only
	$(COMPOSE_DEV) logs -f --tail=100 frontend

.PHONY: logs-db
logs-db: ## Tail database logs only
	$(COMPOSE_DEV) logs -f --tail=100 postgres

# ── Status & Debugging ──────────────────────────────────────

.PHONY: status
status: ## Show status of all services
	$(COMPOSE_DEV) ps

.PHONY: health
health: ## Check backend health endpoint
	@curl -s http://localhost:8000/health | python -m json.tool 2>/dev/null || echo "Backend not responding"

.PHONY: shell-backend
shell-backend: ## Open a bash shell inside the backend container
	$(COMPOSE_DEV) exec backend bash

.PHONY: shell-frontend
shell-frontend: ## Open a shell inside the frontend container
	$(COMPOSE_DEV) exec frontend sh

# ── Lifecycle ────────────────────────────────────────────────

.PHONY: down
down: ## Stop all services (keep volumes)
	$(COMPOSE_DEV) down
	@echo "✅ All services stopped."

.PHONY: restart
restart: ## Restart all services
	$(COMPOSE_DEV) restart
	@echo "✅ All services restarted."

.PHONY: restart-backend
restart-backend: ## Restart only the backend service
	$(COMPOSE_DEV) restart backend

.PHONY: rebuild
rebuild: ## Rebuild and restart all services
	$(COMPOSE_DEV) up --build -d

.PHONY: clean
clean: ## Stop services and remove ALL data (volumes, images)
	$(COMPOSE_DEV) down -v --rmi local
	@echo "🗑️  All services, volumes, and local images removed."

# ── Testing ──────────────────────────────────────────────────

.PHONY: test
test: ## Run backend tests inside the container
	$(COMPOSE_DEV) exec backend pytest -v

.PHONY: lint
lint: ## Run frontend linter
	$(COMPOSE_DEV) exec frontend npm run lint

# ── Setup ────────────────────────────────────────────────────

.PHONY: setup
setup: ## Initial project setup — copy .env.example, build, migrate
	@test -f .env || (cp .env.example .env && echo "📝 Created .env from .env.example — fill in your values!")
	$(COMPOSE_DEV) up --build -d
	@echo "⏳ Waiting for postgres to be ready..."
	@sleep 5
	$(COMPOSE_DEV) exec backend alembic upgrade head
	@echo ""
	@echo "✅ Setup complete!"
	@echo "   1. Edit .env with your API keys"
	@echo "   2. Visit http://localhost:3000"
	@echo ""

# ── Help ─────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "Skillmate AI — Available Commands"
	@echo "════════════════════════════════════════════════"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
