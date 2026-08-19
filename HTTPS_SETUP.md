# Skillmate AI — HTTPS Setup Guide

> Complete step-by-step guide to obtain a free Let's Encrypt SSL certificate and enable HTTPS in production using Certbot's **HTTP-01 webroot challenge**.

---

## Prerequisites

Before you begin, ensure:

- [ ] A **registered domain name** (e.g. `skillmate.ai`)
- [ ] DNS **A record** pointing your domain to the server's public IP
- [ ] **Port 80** reachable from the internet (no firewall blocking)
- [ ] **Port 443** reachable from the internet
- [ ] Docker + Docker Compose installed on the server
- [ ] Project cloned to `/opt/skillmate` (or your deploy path)

---

## Architecture Overview

```
                   HTTP-01 Challenge Flow
┌──────────────┐          ┌───────────────┐        ┌────────────────┐
│ Let's Encrypt│ ─GET──▶  │  Nginx :80    │ ─────▶ │ /var/www/      │
│   servers    │          │ /.well-known/ │        │ certbot/       │
└──────────────┘          │ acme-challenge│        │ .well-known/   │
                          └───────────────┘        └────────────────┘
                                                         ▲
                                                    certbot-init
                                                    writes token here
```

**Why webroot?** Nginx keeps running during cert issuance — zero downtime. The `certbot-init` container writes a temporary token file to the shared `certbot_webroot` volume. Let's Encrypt fetches it over HTTP to verify domain ownership.

---

## Step 1 — Configure Your Domain

Add these env vars to your server's `.env` file:

```bash
# Edit /opt/skillmate/.env
DOMAIN_NAME=skillmate.ai          # ← Your actual domain (no https://)
EMAIL=admin@skillmate.ai          # ← Your email (for expiry alerts)
SSL_MODE=off                      # ← Keep OFF until cert is issued
FRONTEND_URL=https://skillmate.ai # ← Update after cert is obtained
```

Verify DNS is correct:

```bash
dig +short skillmate.ai
# Should return your server's public IP
curl -s https://api.ipify.org     # Your server's IP
```

---

## Step 2 — Start the Stack in HTTP Mode

Start everything **without** SSL first. Nginx needs to be running on port 80 to handle the ACME challenge.

```bash
cd /opt/skillmate

# Export the vars
export $(grep -v '^#' .env | xargs)

# Start with SSL_MODE=off (HTTP only)
SSL_MODE=off docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d
```

Verify Nginx is serving on port 80:

```bash
curl -I http://skillmate.ai
# Expected: HTTP/1.1 200 OK  (or 301 if anything redirects)
```

---

## Step 3 — Obtain the Certificate

Run the one-shot `certbot-init` container. It will:
1. Write an ACME token to `/var/www/certbot/.well-known/acme-challenge/`
2. Let's Encrypt fetches it over HTTP to verify your domain
3. Certificate is saved to the `letsencrypt` Docker volume

```bash
DOMAIN_NAME=skillmate.ai \
EMAIL=admin@skillmate.ai \
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.certbot.yml \
  run --rm certbot-init
```

**Expected output:**
```
🔐 Requesting certificate for skillmate.ai...
Saving debug log to /var/log/letsencrypt/letsencrypt.log
Account registered.
Requesting a certificate for skillmate.ai and www.skillmate.ai

Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/skillmate.ai/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/skillmate.ai/privkey.pem
This certificate expires on 2025-10-25.
✅ Certificate obtained! Restart nginx with SSL_MODE=on.
```

> **Troubleshooting:** If you see `Connection refused` or `Timeout`, check that:
> - Port 80 is open in your firewall/security group
> - Nginx is running (`docker ps | grep nginx`)
> - DNS is pointing to this server (`dig +short skillmate.ai`)

---

## Step 4 — Enable HTTPS in Nginx

Update your `.env`:

```bash
SSL_MODE=on
FRONTEND_URL=https://skillmate.ai
```

Restart nginx to load the SSL server block:

```bash
export $(grep -v '^#' .env | xargs)

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.certbot.yml \
  up -d nginx
```

The entrypoint script will detect `/etc/letsencrypt/live/skillmate.ai/fullchain.pem` and activate the HTTPS server block automatically.

---

## Step 5 — Verify HTTPS

```bash
# Should return 200 over HTTPS
curl -v https://skillmate.ai/health

# Check certificate details
curl -vI https://skillmate.ai 2>&1 | grep -E "SSL|issuer|expire"

# Online check
# → https://www.ssllabs.com/ssltest/analyze.html?d=skillmate.ai
```

You should see:
- **Issuer:** Let's Encrypt
- **Grade:** A or A+ on SSL Labs

---

## Step 6 — Start Auto-Renewal

Start the `certbot-renew` sidecar. It wakes up every minute, checks if the time is 00:05 or 12:05 UTC, and runs `certbot renew` (which only renews if expiry is within 30 days). After renewal, it signals nginx to reload with zero downtime.

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.certbot.yml \
  up -d certbot-renew
```

Verify it started:

```bash
docker logs skillmate-certbot-renew --tail 20
```

---

## Renewal Timing

| Time (UTC) | Action |
|------------|--------|
| 00:05 | `certbot renew --quiet` runs |
| 12:05 | `certbot renew --quiet` runs |
| After renewal | `nginx -s reload` (zero downtime) |

Let's Encrypt certs expire in **90 days**. Certbot only renews when **30 days or fewer** remain. So the renewal actually runs only once every ~60 days, but the twice-daily check ensures it never slips.

---

## Or: Use the Automated Script

Instead of the manual steps above, run the all-in-one script:

```bash
DOMAIN_NAME=skillmate.ai \
EMAIL=admin@skillmate.ai \
bash scripts/setup_ssl.sh
```

---

## Directory Structure

```
/opt/skillmate/
├── docker-compose.yml            # Base services
├── docker-compose.prod.yml       # Production overrides (nginx config)
├── docker-compose.certbot.yml    # Certbot services (overlay)
├── nginx/
│   ├── Dockerfile                # Uses envsubst + entrypoint
│   ├── docker-entrypoint.sh      # Renders templates, starts nginx
│   ├── nginx.conf                # Dev HTTP-only fallback
│   ├── nginx.conf.template       # Template with ${DOMAIN_NAME}
│   └── ssl_server.conf.template  # HTTPS server block template
└── scripts/
    └── setup_ssl.sh              # Automated cert issuance script

Docker Volumes:
  letsencrypt    → /etc/letsencrypt   (certs — shared between certbot & nginx)
  certbot_webroot → /var/www/certbot  (ACME challenge tokens)
```

---

## Local Development (No SSL Needed)

In local dev, simply don't set `SSL_MODE`:

```bash
# .env (local dev)
DOMAIN_NAME=localhost
SSL_MODE=off
```

```bash
docker compose up -d
```

Nginx will serve on `http://localhost:80` — no certificate required.

---

## Troubleshooting

### `certbot: error: Connection timed out`
- Port 80 is blocked. Check: `ufw allow 80` or cloud security group rules
- Nginx not running: `docker compose up -d nginx`

### `SSL_ERROR_RX_RECORD_TOO_LONG` in browser
- Nginx is serving HTTP on port 443. SSL_MODE is likely `off`. Check your `.env`.

### `certificate not yet valid`
- System clock may be wrong. Fix: `timedatectl set-ntp true`

### Renewal not working
- Check: `docker logs skillmate-certbot-renew`
- Manual force-renewal: `docker compose -f ... run --rm certbot-renew certbot renew --force-renewal`

### Check cert expiry
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.certbot.yml \
  exec certbot-renew certbot certificates
```
