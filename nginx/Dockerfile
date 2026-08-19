# ============================================================
# Skillmate AI — Nginx (Production)
# ============================================================
# Uses envsubst to render ${DOMAIN_NAME} in config templates
# at container start. Supports both HTTP-only (dev) and
# HTTPS (prod) modes via SSL_MODE env var.
# ============================================================
FROM nginx:1.27-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy templates (NOT rendered configs — those are generated at startup)
COPY nginx.conf.template        /etc/nginx/templates/nginx.conf.template
COPY ssl_server.conf.template   /etc/nginx/templates/ssl_server.conf.template

# Create directories
RUN mkdir -p \
    /var/www/certbot \
    /etc/nginx/conf.d \
    /etc/letsencrypt

# Copy and set up entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
