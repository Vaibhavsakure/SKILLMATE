/**
 * Skillmate AI — k6 Load Test Suite
 * ====================================
 * Tests four scenarios in sequence: smoke → load → stress → spike
 *
 * Environment variables required:
 *   BASE_URL       e.g. http://localhost:8000 (no trailing slash)
 *   K6_AUTH_TOKEN  valid Supabase JWT for an existing test user
 *
 * Run:
 *   k6 run \
 *     -e BASE_URL=http://localhost:8000 \
 *     -e K6_AUTH_TOKEN=eyJ... \
 *     k6_load_test.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const errorRate     = new Rate("error_rate");        // tracks non-2xx responses
const atsLatency    = new Trend("ats_latency");      // per-endpoint latency
const rewriteLatency = new Trend("rewrite_latency");
const balanceLatency = new Trend("balance_latency");

// ---------------------------------------------------------------------------
// Sample resume constant (~50 words)
// ---------------------------------------------------------------------------

const SAMPLE_RESUME = `
Jane Doe | jane@example.com | github.com/janedoe
Software Engineer with 4 years of experience in Python, FastAPI, and React.
Led delivery of microservices handling 2M daily requests. Reduced deployment time
by 40% via CI/CD automation. AWS Certified Developer. Proficient in PostgreSQL,
Redis, Docker, and Kubernetes. Passionate about clean code and developer tooling.
`.trim();

const SAMPLE_JD = `
We are looking for a Backend Engineer with experience in Python, FastAPI, Docker,
and PostgreSQL. Experience with Redis caching and cloud deployments is a plus.
`.trim();

// ---------------------------------------------------------------------------
// k6 options — four named scenarios executed via startTime sequencing
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "";

export const options = {
  // ── Global thresholds ───────────────────────────────────────────────────
  thresholds: {
    // 95th percentile response time must stay under 2 seconds
    http_req_duration: ["p(95)<2000"],
    // Error rate (non-2xx) under 1%
    error_rate:        ["rate<0.01"],
    // k6 built-in failed-request rate under 1%
    http_req_failed:   ["rate<0.01"],
  },

  // ── Scenarios ───────────────────────────────────────────────────────────
  scenarios: {

    // 1. SMOKE — sanity check: 1 VU, 30s
    smoke: {
      executor:    "constant-vus",
      vus:         1,
      duration:    "30s",
      startTime:   "0s",
      exec:        "smokeTest",
      tags:        { scenario: "smoke" },
    },

    // 2. LOAD — normal traffic: 50 VUs sustained for 5 minutes
    //    Starts 35s after smoke so smoke always finishes first
    load: {
      executor:    "constant-vus",
      vus:         50,
      duration:    "5m",
      startTime:   "35s",
      exec:        "loadTest",
      tags:        { scenario: "load" },
    },

    // 3. STRESS — ramp 0 → 200 VUs over 10 minutes
    //    Starts after load ends (35s + 5min + 10s buffer = 6m25s)
    stress: {
      executor:    "ramping-vus",
      startTime:   "6m25s",
      startVUs:    0,
      stages: [
        { duration: "2m",  target: 50  },   // warm-up
        { duration: "4m",  target: 200 },   // ramp to stress
        { duration: "3m",  target: 200 },   // sustain
        { duration: "1m",  target: 0   },   // cool-down
      ],
      exec:        "stressTest",
      tags:        { scenario: "stress" },
    },

    // 4. SPIKE — sudden burst: 500 VUs for 30 seconds
    //    Starts after stress ends (6m25s + 10m + 10s buffer = 16m35s)
    spike: {
      executor:    "constant-vus",
      vus:         500,
      duration:    "30s",
      startTime:   "16m35s",
      exec:        "spikeTest",
      tags:        { scenario: "spike" },
    },
  },
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Build the common auth + JSON headers. */
function authHeaders(contentType = "application/json") {
  const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

/**
 * Assert a response is successful and track it in the shared error rate.
 * Returns true if the response is 2xx.
 */
function assertOk(res, label) {
  const ok = check(res, {
    [`${label}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${label}: body not empty`]: (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!ok);
  return ok;
}

// ---------------------------------------------------------------------------
// Scenario 1 — SMOKE
// GET /health — lightweight sanity check
// ---------------------------------------------------------------------------

export function smokeTest() {
  const res = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });

  check(res, {
    "smoke: /health status 200":    (r) => r.status === 200,
    "smoke: response time < 500ms": (r) => r.timings.duration < 500,
  });
  errorRate.add(res.status !== 200);

  sleep(1);
}

// ---------------------------------------------------------------------------
// Scenario 2 — LOAD
// POST /api/v1/ats — ATS score analysis
// ---------------------------------------------------------------------------

export function loadTest() {
  const payload = JSON.stringify({
    resume_text: SAMPLE_RESUME,
    jd_text:     SAMPLE_JD,
  });

  const res = http.post(
    `${BASE_URL}/api/v1/ats`,
    payload,
    {
      headers: authHeaders(),
      tags:    { name: "ats_score" },
    }
  );

  atsLatency.add(res.timings.duration);
  assertOk(res, "load/ats");

  // Verify expected fields are present in the JSON body
  if (res.status === 200) {
    let body;
    try { body = JSON.parse(res.body); } catch (_) { body = {}; }
    check(body, {
      "load/ats: has ats_score field": (b) =>
        b.ats_score !== undefined ||
        (b.data && b.data.ats_score !== undefined),
    });
  }

  sleep(Math.random() * 2 + 1); // 1-3s think time
}

// ---------------------------------------------------------------------------
// Scenario 3 — STRESS
// POST /api/v1/resume/rewrite — expensive AI endpoint (form-data)
// ---------------------------------------------------------------------------

export function stressTest() {
  // resume/rewrite uses multipart form-data (text fields)
  const data = {
    resume_text:     SAMPLE_RESUME,
    job_description: SAMPLE_JD,
    tone:            "Professional",
  };

  const res = http.post(
    `${BASE_URL}/api/v1/resume/rewrite`,
    data,   // k6 auto-encodes plain objects as application/x-www-form-urlencoded
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      tags:    { name: "resume_rewrite" },
      // Long timeout — AI endpoint can take a few seconds
      timeout: "30s",
    }
  );

  rewriteLatency.add(res.timings.duration);
  assertOk(res, "stress/rewrite");

  sleep(Math.random() * 3 + 2); // 2-5s think time
}

// ---------------------------------------------------------------------------
// Scenario 4 — SPIKE
// GET /api/v1/credits/balance — fast, cached-friendly read endpoint
// ---------------------------------------------------------------------------

export function spikeTest() {
  const res = http.get(
    `${BASE_URL}/api/v1/credits/balance`,
    {
      headers: authHeaders(),
      tags:    { name: "credits_balance" },
    }
  );

  balanceLatency.add(res.timings.duration);
  assertOk(res, "spike/balance");

  // No sleep — we want to hammer the endpoint during the spike
}
