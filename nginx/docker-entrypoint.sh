#!/bin/sh
# ============================================================
# Skillmate AI — Nginx Entrypoint
# ============================================================
# Renders nginx config templates using envsubst, then starts nginx.
#
# Env vars:
#   DOMAIN_NAME  — Domain name (default: localhost)
#   SSL_MODE     — "on" to enable HTTPS (default: off)
# ============================================================

set -e

DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
SSL_MODE="${SSL_MODE:-off}"

echo "╔══════════════════════════════════════════╗"
echo "║  Skillmate AI — Nginx                    ║"
echo "║  Domain:   ${DOMAIN_NAME}"
echo "║  SSL Mode: ${SSL_MODE}"
echo "╚══════════════════════════════════════════╝"

# ── Render main config template ────────────────────────────
envsubst '${DOMAIN_NAME}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/skillmate.conf

# ── Handle SSL mode ────────────────────────────────────────
if [ "$SSL_MODE" = "on" ]; then
    CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"

    if [ -f "$CERT_PATH" ]; then
        echo "✅ SSL certificates found — enabling HTTPS"

        # Render SSL server block
        envsubst '${DOMAIN_NAME}' \
          < /etc/nginx/templates/ssl_server.conf.template \
          > /etc/nginx/conf.d/ssl_server.conf

        # HTTP → HTTPS redirect
        cat > /etc/nginx/conf.d/ssl_redirect.conf << 'EOF'
    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
EOF
    else
        echo "⚠️  SSL_MODE=on but certificates not found at: $CERT_PATH"
        echo "    Falling back to HTTP-only mode."
        echo "    Run certbot first — see HTTPS_SETUP.md"

        # Empty SSL server (no HTTPS)
        echo "" > /etc/nginx/conf.d/ssl_server.conf

        # Serve over HTTP (dev-style proxy rules)
        cat > /etc/nginx/conf.d/ssl_redirect.conf << 'DEVEOF'
    # ── DEV / HTTP-only mode (no SSL certs) ──────────────

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml font/woff2;

    client_max_body_size 20M;
    limit_req zone=skillmate_limit burst=20 nodelay;
    limit_req_status 429;

    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 120s;
    }

    location /health {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /_next/static/ {
        proxy_pass http://frontend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
DEVEOF
    fi
else
    echo "ℹ️  SSL disabled — running in HTTP-only mode (local dev)"

    # Empty SSL server
    echo "" > /etc/nginx/conf.d/ssl_server.conf

    # Full HTTP proxy (same as the fallback above)
    cat > /etc/nginx/conf.d/ssl_redirect.conf << 'DEVEOF'
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml font/woff2;

    client_max_body_size 20M;
    limit_req zone=skillmate_limit burst=20 nodelay;
    limit_req_status 429;

    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 120s;
    }

    location /health {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /_next/static/ {
        proxy_pass http://frontend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
DEVEOF
fi

echo "🚀 Starting nginx..."
exec nginx -g "daemon off;"
