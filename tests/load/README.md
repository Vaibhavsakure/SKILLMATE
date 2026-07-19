# Load Testing — Skillmate AI API

## Prerequisites

### Install k6
```bash
# macOS
brew install k6

# Windows (winget)
winget install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker (no install needed)
docker pull grafana/k6
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BASE_URL` | ✅ | API root, no trailing slash. e.g. `http://localhost:8000` |
| `K6_AUTH_TOKEN` | ✅ | Valid Supabase JWT for a test user account |

---

## Running the Full Test Suite

```bash
k6 run \
  -e BASE_URL=http://localhost:8000 \
  -e K6_AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  tests/load/k6_load_test.js
```

### Using Docker

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:8000 \
  -e K6_AUTH_TOKEN=eyJ... \
  -v "$(pwd)/tests/load:/scripts" \
  grafana/k6 run /scripts/k6_load_test.js
```

---

## Running Individual Scenarios

k6 doesn't natively filter scenarios via CLI, but you can set `startTime` overrides
or use a wrapper env var. The simplest approach is to comment out unwanted scenarios
in the `options.scenarios` block before running.

### Smoke only (quick sanity check — ~30 seconds)

```bash
k6 run \
  -e BASE_URL=http://localhost:8000 \
  -e K6_AUTH_TOKEN=eyJ... \
  --duration 30s --vus 1 \
  --env SCENARIO=smoke \
  tests/load/k6_load_test.js
```

---

## Scenario Summary

| # | Name | VUs | Duration | Target Endpoint | Purpose |
|---|---|---|---|---|---|
| 1 | **smoke** | 1 | 30s | `GET /health` | Sanity — API up? |
| 2 | **load** | 50 | 5min | `POST /api/v1/ats` | Normal daily traffic |
| 3 | **stress** | 0 → 200 (ramp) | 10min | `POST /api/v1/resume/rewrite` | Breaking point discovery |
| 4 | **spike** | 500 | 30s | `GET /api/v1/credits/balance` | Sudden surge resilience |

Total test run time: ~17 minutes

---

## Pass/Fail Thresholds

| Metric | Threshold | Meaning |
|---|---|---|
| `http_req_duration[p95]` | `< 2000ms` | 95% of requests complete in under 2s |
| `error_rate` | `< 1%` | Less than 1% non-2xx responses |
| `http_req_failed` | `< 1%` | Less than 1% of requests fail at transport level |

k6 exits with code `99` if any threshold is breached (use in CI pipelines).

---

## Reading the Output

```
✓ smoke: /health status 200
✓ load/ats: status 2xx
✗ stress/rewrite: status 2xx   ← failing requests appear here

http_req_duration............: avg=312ms min=45ms med=280ms max=4.2s p(90)=890ms p(95)=1.1s
http_req_failed..............: 0.23% ✓ 4412  ✗ 10
error_rate...................: 0.18% ✓ 4416  ✗ 8
ats_latency..................: avg=421ms p(95)=1.3s
rewrite_latency..............: avg=2.1s  p(95)=4.8s   ← AI endpoints are slower
balance_latency..............: avg=18ms  p(95)=45ms
```

---

## Exporting Results

### JSON output (machine-readable)

```bash
k6 run \
  -e BASE_URL=http://localhost:8000 \
  -e K6_AUTH_TOKEN=eyJ... \
  --out json=results/k6_results.json \
  tests/load/k6_load_test.js
```

### InfluxDB + Grafana (real-time dashboard)

```bash
# Assumes InfluxDB running on localhost:8086
k6 run \
  -e BASE_URL=http://localhost:8000 \
  -e K6_AUTH_TOKEN=eyJ... \
  --out influxdb=http://localhost:8086/k6 \
  tests/load/k6_load_test.js
```

---

## CI Integration (GitHub Actions)

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  workflow_dispatch:        # run manually
  schedule:
    - cron: "0 2 * * 1"   # every Monday at 2am UTC

jobs:
  k6:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.51.0/k6-v0.51.0-linux-amd64.tar.gz \
            -L | tar xvz --strip-components 1
          sudo mv k6 /usr/local/bin/

      - name: Run load tests
        env:
          BASE_URL: ${{ secrets.STAGING_API_URL }}
          K6_AUTH_TOKEN: ${{ secrets.K6_TEST_TOKEN }}
        run: k6 run tests/load/k6_load_test.js
```

---

## Generating a Test Token

Use Supabase CLI or the REST API to sign in as a dedicated test user:

```bash
# Using curl
curl -X POST "https://<project>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email": "loadtest@skillmate.ai", "password": "your_test_password"}' \
  | jq -r '.access_token'
```

Store the output as the `K6_AUTH_TOKEN` env var.

> **Tip:** Create a dedicated load-test user with no credits to avoid affecting real
> user data. The test user's quota will be consumed during stress runs.
