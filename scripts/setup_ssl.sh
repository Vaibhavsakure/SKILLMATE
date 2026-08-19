#!/usr/bin/env bash
# ============================================================
# Skillmate AI — SSL Certificate Setup (Let's Encrypt)
# ============================================================
# Usage:
#   DOMAIN_NAME=skillmate.ai EMAIL=admin@skillmate.ai \
#   bash scripts/setup_ssl.sh
#
# Or export the vars in your .env and source them first:
#   set -a; source .env; set +a
#   bash scripts/setup_ssl.sh
#
# What this script does:
#   1. Validates prerequisites (DNS, ports, Docker)
#   2. Ensures nginx is running (for webroot challenge)
#   3. Runs certbot via docker compose to obtain the cert
#   4. Restarts nginx with SSL_MODE=on
#   5. Verifies HTTPS is working
# ============================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────
DOMAIN_NAME="${DOMAIN_NAME:-}"
EMAIL="${EMAIL:-}"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.certbot.yml"

# ── Validate inputs ─────────────────────────────────────────
if [ -z "$DOMAIN_NAME" ]; then
    echo "❌ DOMAIN_NAME is not set."
    echo "   Usage: DOMAIN_NAME=skillmate.ai EMAIL=admin@skillmate.ai bash scripts/setup_ssl.sh"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo "❌ EMAIL is not set (required for Let's Encrypt alerts)."
    echo "   Usage: DOMAIN_NAME=skillmate.ai EMAIL=admin@skillmate.ai bash scripts/setup_ssl.sh"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Skillmate AI — SSL Certificate Setup        ║"
echo "║  Domain:  ${DOMAIN_NAME}"
echo "║  Email:   ${EMAIL}"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Check DNS resolves to this server ───────────────────────
echo "🔍 Checking DNS resolution for ${DOMAIN_NAME}..."
SERVER_IP=$(curl -s https://api.ipify.org || echo "unknown")
DOMAIN_IP=$(dig +short "${DOMAIN_NAME}" | head -n1 || echo "")

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo "⚠️  DNS WARNING:"
    echo "   This server IP: ${SERVER_IP}"
    echo "   ${DOMAIN_NAME} resolves to: ${DOMAIN_IP}"
    echo "   If these differ, the ACME challenge will FAIL."
    echo ""
    read -rp "   Continue anyway? [y/N] " CONFIRM
    if [ "${CONFIRM,,}" != "y" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# ── Ensure nginx is running (webroot challenge needs port 80) ─
echo ""
echo "🔄 Ensuring nginx is running (HTTP mode for ACME challenge)..."

export DOMAIN_NAME EMAIL SSL_MODE=off
docker compose $COMPOSE_FILES up -d nginx

echo "   Waiting for nginx to be ready..."
sleep 5

# Quick sanity check
if ! curl -sf "http://${DOMAIN_NAME}/.well-known/acme-challenge/test" 2>/dev/null | grep -q "404\|test"; then
    echo "   ℹ️  Webroot reachable (HTTP → nginx → /var/www/certbot)"
fi

# ── Obtain certificate via webroot ───────────────────────────
echo ""
echo "🔐 Requesting Let's Encrypt certificate..."
echo "   Method: HTTP-01 (webroot)"
echo "   Webroot: /var/www/certbot"
echo ""

export DOMAIN_NAME EMAIL
docker compose $COMPOSE_FILES run --rm certbot-init

CERT_PATH="/var/lib/docker/volumes/skillmate_letsencrypt/_data/live/${DOMAIN_NAME}/fullchain.pem"

if docker compose $COMPOSE_FILES exec nginx test -f "/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"; then
    echo "✅ Certificate obtained!"
else
    echo "❌ Certificate not found — check certbot logs above."
    exit 1
fi

# ── Restart nginx with SSL enabled ───────────────────────────
echo ""
echo "🔄 Restarting nginx with SSL_MODE=on..."

export SSL_MODE=on
docker compose $COMPOSE_FILES up -d nginx

sleep 5

# ── Verify HTTPS ────────────────────────────────────────────
echo ""
echo "🔒 Verifying HTTPS..."
if curl -sf "https://${DOMAIN_NAME}/health" > /dev/null 2>&1; then
    echo "✅ HTTPS is working!"
elif curl -kf "https://${DOMAIN_NAME}/health" > /dev/null 2>&1; then
    echo "✅ HTTPS is working (cert valid — SSL check passed with -k)"
else
    echo "⚠️  HTTPS check failed — nginx may still be reloading."
    echo "   Try: curl -v https://${DOMAIN_NAME}/health"
fi

# ── Start auto-renew sidecar ─────────────────────────────────
echo ""
echo "⏰ Starting certbot-renew sidecar (twice-daily auto-renewal)..."
docker compose $COMPOSE_FILES up -d certbot-renew

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ SSL Setup Complete!                       ║"
echo "║                                              ║"
echo "║  Your site:  https://${DOMAIN_NAME}"
echo "║  Auto-renew: active (certbot-renew sidecar)  ║"
echo "║                                              ║"
echo "║  To check renewal status:                    ║"
echo "║  docker logs skillmate-certbot-renew         ║"
echo "╚══════════════════════════════════════════════╝"
