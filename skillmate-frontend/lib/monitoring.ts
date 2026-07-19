/**
 * Skillmate AI — Frontend Error Monitoring (Sentry Browser SDK)
 * ==============================================================
 * Initialises Sentry once and exports a typed wrapper around the axios
 * `api` instance that captures errors automatically.
 *
 * Usage:
 *   import { initMonitoring, monitoredApi, captureError } from "@/lib/monitoring";
 *   initMonitoring();                          // call in layout.tsx or _app.tsx
 *   const data = await monitoredApi.get(...)  // drop-in replacement for api
 *
 * Environment variables required (.env.local):
 *   NEXT_PUBLIC_SENTRY_DSN=https://...@...ingest.sentry.io/...
 *   NEXT_PUBLIC_SENTRY_ENVIRONMENT=production  (optional, defaults to NODE_ENV)
 *   NEXT_PUBLIC_SENTRY_RELEASE=skillmate@3.0.0 (optional)
 */

import * as Sentry from "@sentry/nextjs";
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { api } from "@/lib/api";

// ── Configuration ───────────────────────────────────────────────

/** Fields that will be stripped from error context before sending to Sentry */
const SENSITIVE_KEYS = new Set([
  "resume_text",
  "raw_text",
  "cv_text",
  "password",
  "token",
  "authorization",
  "stripe_secret_key",
  "anthropic_api_key",
]);

/** Patterns to scrub from strings (email, JWT tokens) */
const PII_PATTERNS: Array<[RegExp, string]> = [
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi, "[email]"],
  [/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, "[jwt]"],
  [/sk_(?:test|live)_[A-Za-z0-9]{24,}/g, "[stripe_key]"],
  [/sk-ant-api\d+-[A-Za-z0-9\-_]{40,}/g, "[anthropic_key]"],
];

// ── PII Scrubbing ───────────────────────────────────────────────

function scrubString(value: string): string {
  let result = value.length > 500 ? value.slice(0, 500) + "...[truncated]" : value;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function scrubData(data: unknown, depth = 0): unknown {
  if (depth > 4) return data;
  if (typeof data === "string") return scrubString(data);
  if (Array.isArray(data)) return data.slice(0, 10).map((item) => scrubData(item, depth + 1));
  if (data !== null && typeof data === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        scrubbed[key] = "[scrubbed]";
      } else {
        scrubbed[key] = scrubData(value, depth + 1);
      }
    }
    return scrubbed;
  }
  return data;
}

// ── Sentry Initialisation ───────────────────────────────────────

let _initialised = false;

export function initMonitoring(): void {
  if (_initialised || typeof window === "undefined") return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.info("[Monitoring] Sentry DSN not configured — error tracking disabled.");
    return;
  }

  const environment =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "development";

  const release =
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "skillmate@3.0.0";

  Sentry.init({
    dsn,
    environment,
    release,

    // Performance: 10% of page loads get traced
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,

    // Replay: capture 10% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      // Session Replay (records DOM snapshots on errors)
      Sentry.replayIntegration({
        maskAllText: true,       // Mask all text for privacy
        blockAllMedia: true,     // Block images/video
      }),
      // Browser Tracing (captures page loads and navigations)
      Sentry.browserTracingIntegration(),
    ],

    // PII scrubbing hook — runs before every event is sent
    beforeSend(event) {
      // Drop noisy / expected errors
      const errorMessage = event.exception?.values?.[0]?.value ?? "";
      if (
        errorMessage.includes("ResizeObserver loop") ||
        errorMessage.includes("Non-Error promise rejection") ||
        errorMessage.includes("Network Error") && environment === "development"
      ) {
        return null;
      }

      // Scrub request body
      if (event.request?.data) {
        event.request.data = scrubData(event.request.data);
      }

      // Scrub breadcrumbs
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
          ...bc,
          data: bc.data ? (scrubData(bc.data) as typeof bc.data) : bc.data,
        }));
      } else if (event.breadcrumbs && Array.isArray((event.breadcrumbs as any).values)) {
        (event.breadcrumbs as any).values = (event.breadcrumbs as any).values.map((bc: any) => ({
          ...bc,
          data: bc.data ? (scrubData(bc.data) as typeof bc.data) : bc.data,
        }));
      }

      // Remove auth headers
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        if (headers["Authorization"]) headers["Authorization"] = "[scrubbed]";
        if (headers["Cookie"]) headers["Cookie"] = "[scrubbed]";
      }

      return event;
    },

    // Never send raw PII fields that Sentry collects by default
    sendDefaultPii: false,
  });

  _initialised = true;
  console.info(`[Monitoring] Sentry initialised | env=${environment}`);
}

// ── Typed Error Capture Helpers ─────────────────────────────────

/**
 * Capture any error with structured context.
 * Scrubs PII from the context before sending.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("api_context", scrubData(context) as Record<string, unknown>);
    }

    if (error instanceof AxiosError) {
      // Add HTTP context without leaking response body content
      scope.setTag("http.status_code", String(error.response?.status ?? "unknown"));
      scope.setTag("http.method", error.config?.method?.toUpperCase() ?? "unknown");
      scope.setTag(
        "http.url",
        // Strip query params to avoid leaking sensitive tokens
        error.config?.url?.split("?")[0] ?? "unknown",
      );
      scope.setExtra("http.response_status", error.response?.status);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a user-facing message (non-error analytics event).
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>,
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("context", scrubData(context) as Record<string, unknown>);
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Identify the currently logged-in user to Sentry.
 * Only sets non-PII fields (id only — no email/name).
 */
export function identifyUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

export function clearUser(): void {
  Sentry.setUser(null);
}

// ── Monitored API Wrapper ───────────────────────────────────────

/**
 * Drop-in replacement for the `api` axios instance.
 * Intercepts all responses and automatically captures errors in Sentry.
 *
 * Usage:
 *   import { monitoredApi } from "@/lib/monitoring";
 *   const data = await monitoredApi.get("/credits/balance", { headers: ... });
 */
function _createMonitoredApi(instance: AxiosInstance): AxiosInstance {
  const monitored = axios.create(instance.defaults);

  // Add Sentry distributed tracing headers
  monitored.interceptors.request.use((config) => {
    // Propagate Sentry trace context to backend for full-stack tracing
    const sentryTrace = Sentry.getActiveSpan()
      ? Sentry.spanToTraceHeader(Sentry.getActiveSpan()!)
      : undefined;
    if (sentryTrace) {
      config.headers["sentry-trace"] = sentryTrace;
    }
    return config;
  });

  // Intercept errors and send to Sentry
  monitored.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // Don't capture 401 (expected — user not logged in) or 404 (not found)
      const status = error.response?.status;
      const shouldCapture = status !== undefined && status >= 500;

      if (shouldCapture) {
        captureError(error, {
          endpoint: error.config?.url,
          method: error.config?.method,
          status_code: status,
        });
      }

      return Promise.reject(error);
    },
  );

  return monitored;
}

export const monitoredApi = _createMonitoredApi(api);
