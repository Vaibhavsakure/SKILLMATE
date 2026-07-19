"use client";

/**
 * Skillmate AI — Admin Health Dashboard
 * =======================================
 * Route: /admin/health
 *
 * Polls GET /health and GET /metrics every 30 seconds and renders
 * a live-updating status dashboard with green/red indicator cards.
 *
 * Accessible to authenticated users only (gate in middleware.ts if needed).
 */

import { useEffect, useState, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────

interface ServiceStatus {
  status: string;
  type?: string;
  detail?: string;
}

interface HealthData {
  status: "healthy" | "degraded" | "unreachable";
  version: string;
  environment: string;
  services: {
    database?: ServiceStatus;
    ai?: { claude: string; groq: string; ollama: string };
    auth?: { supabase: string };
    payments?: { stripe: string };
  };
  latency_ms?: number;
}

interface MetricsData {
  uptime_seconds: number;
  uptime_human: string;
  request_count: number;
  error_count: number;
  error_rate: number;
  ai_provider_used: string;
  ai_provider_counts: { claude: number; groq: number; ollama: number };
}

type PollStatus = "idle" | "polling" | "error";

// ── Constants ────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/python";

// ── Helpers ──────────────────────────────────────────────────────

function isGreen(value: string | undefined): boolean {
  if (!value) return false;
  return ["healthy", "connected", "configured", "ok"].includes(value.toLowerCase());
}

function formatErrorRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

// ── Sub-components ───────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0 ${
        ok ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-500 shadow-[0_0_6px_#f87171]"
      }`}
      aria-label={ok ? "healthy" : "unhealthy"}
    />
  );
}

function Card({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-500 ${
        ok
          ? "border-emerald-500/30 bg-emerald-950/20 shadow-[inset_0_0_30px_rgba(52,211,153,0.04)]"
          : "border-red-500/30 bg-red-950/20 shadow-[inset_0_0_30px_rgba(248,113,113,0.04)] animate-pulse"
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusDot ok={ok} />
        <span className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
          {title}
        </span>
        <span
          className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
            ok ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"
          }`}
        >
          {ok ? "OK" : "DEGRADED"}
        </span>
      </div>
      <div className="text-sm text-slate-400 space-y-1">{children}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-slate-200 font-mono text-sm">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-slate-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [pollStatus, setPollStatus] = useState<PollStatus>("idle");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch both endpoints ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setPollStatus("polling");
    try {
      const healthStart = performance.now();
      const [healthRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { cache: "no-store" }),
        fetch(`${API_BASE}/metrics`, { cache: "no-store" }),
      ]);
      const latency = Math.round(performance.now() - healthStart);

      const healthJson: HealthData = healthRes.ok
        ? await healthRes.json()
        : { status: "unreachable", version: "-", environment: "-", services: {}, latency_ms: latency };

      const metricsJson: MetricsData | null = metricsRes.ok
        ? await metricsRes.json()
        : null;

      setHealth({ ...healthJson, latency_ms: latency });
      setMetrics(metricsJson);
      setLastChecked(new Date());
      setPollStatus("idle");
      setCountdown(POLL_INTERVAL_MS / 1000);
    } catch {
      setHealth((prev) =>
        prev ? { ...prev, status: "unreachable" } : null,
      );
      setPollStatus("error");
      setCountdown(POLL_INTERVAL_MS / 1000);
    }
  }, []);

  // ── Polling loop ─────────────────────────────────────────────
  useEffect(() => {
    fetchAll();

    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchAll]);

  // ── Derived values ────────────────────────────────────────────
  const overallOk = health?.status === "healthy";
  const dbOk = health?.services.database?.status === "connected";
  const aiClaudeOk = isGreen(health?.services.ai?.claude);
  const aiGroqOk = isGreen(health?.services.ai?.groq);
  const supabaseOk = isGreen(health?.services.auth?.supabase);
  const stripeOk = isGreen(health?.services.payments?.stripe);

  const errorRateOk =
    !metrics || metrics.error_rate < 0.05; // <5% error rate = green

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 font-sans">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              overallOk
                ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                : "bg-red-500 shadow-[0_0_10px_#f87171] animate-pulse"
            }`}
          />
          <h1 className="text-lg font-bold tracking-tight">
            Skillmate AI — Health Dashboard
          </h1>
          {health && (
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                overallOk
                  ? "bg-emerald-900/60 text-emerald-300"
                  : "bg-red-900/60 text-red-300"
              }`}
            >
              {health.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          {pollStatus === "polling" && (
            <span className="flex items-center gap-1.5">
              <Spinner /> Checking...
            </span>
          )}
          {lastChecked && (
            <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
          )}
          <button
            onClick={fetchAll}
            disabled={pollStatus === "polling"}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors text-xs font-medium"
            aria-label="Refresh now"
          >
            ↻ Refresh
          </button>
          <span className="text-slate-600">
            Auto-refresh in{" "}
            <span className="font-mono text-slate-400">{countdown}s</span>
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* ── Environment banner ── */}
        {health && (
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {[
              { label: "ENV", value: health.environment },
              { label: "VER", value: health.version },
              {
                label: "LATENCY",
                value: health.latency_ms != null ? `${health.latency_ms}ms` : "-",
              },
            ].map(({ label, value }) => (
              <span
                key={label}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400"
              >
                <span className="text-slate-600 mr-1.5">{label}</span>
                {value}
              </span>
            ))}
          </div>
        )}

        {/* ── Service status cards ── */}
        <section aria-label="Service status">
          <h2 className="text-xs uppercase tracking-widest text-slate-600 mb-4 font-semibold">
            Service Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Database */}
            <Card title="Database" ok={dbOk}>
              <MetricRow label="Status" value={health?.services.database?.status ?? "—"} />
              <MetricRow label="Type" value={health?.services.database?.type ?? "—"} />
              {!dbOk && health?.services.database?.detail && (
                <p className="text-red-400 text-xs mt-1 break-all">
                  {health.services.database.detail}
                </p>
              )}
            </Card>

            {/* AI Providers */}
            <Card title="AI Providers" ok={aiClaudeOk || aiGroqOk}>
              <MetricRow label="Claude" value={health?.services.ai?.claude ?? "—"} />
              <MetricRow label="Groq" value={health?.services.ai?.groq ?? "—"} />
              <MetricRow label="Ollama" value={health?.services.ai?.ollama ?? "—"} />
              {metrics && (
                <MetricRow
                  label="Primary provider"
                  value={metrics.ai_provider_used}
                />
              )}
            </Card>

            {/* Auth */}
            <Card title="Authentication" ok={supabaseOk}>
              <MetricRow label="Supabase" value={health?.services.auth?.supabase ?? "—"} />
            </Card>

            {/* Payments */}
            <Card title="Payments" ok={stripeOk}>
              <MetricRow label="Stripe" value={health?.services.payments?.stripe ?? "—"} />
            </Card>

            {/* Error Rate */}
            <Card title="Error Rate" ok={errorRateOk}>
              <MetricRow
                label="Rate"
                value={metrics ? formatErrorRate(metrics.error_rate) : "—"}
              />
              <MetricRow label="Total errors" value={metrics ? formatNumber(metrics.error_count) : "—"} />
              <MetricRow label="Total requests" value={metrics ? formatNumber(metrics.request_count) : "—"} />
            </Card>

            {/* Uptime */}
            <Card title="Uptime" ok={!!metrics}>
              <MetricRow label="Human" value={metrics?.uptime_human ?? "—"} />
              <MetricRow
                label="Seconds"
                value={metrics ? formatNumber(metrics.uptime_seconds) : "—"}
              />
            </Card>
          </div>
        </section>

        {/* ── AI Provider breakdown ── */}
        {metrics && (
          <section aria-label="AI provider usage">
            <h2 className="text-xs uppercase tracking-widest text-slate-600 mb-4 font-semibold">
              AI Provider Usage
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
              {Object.entries(metrics.ai_provider_counts).map(([provider, count]) => {
                const total = Object.values(metrics.ai_provider_counts).reduce(
                  (a, b) => a + b,
                  0,
                );
                const pct = total > 0 ? (count / total) * 100 : 0;
                const isPrimary = provider === metrics.ai_provider_used;
                return (
                  <div key={provider} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 capitalize flex items-center gap-1.5">
                        {isPrimary && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                        )}
                        {provider}
                      </span>
                      <span className="text-slate-300 font-mono">
                        {formatNumber(count)} calls ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isPrimary ? "bg-sky-500" : "bg-slate-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Unreachable / error banner ── */}
        {pollStatus === "error" && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 px-5 py-4 text-sm text-red-300 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            Backend is unreachable. Check that the API server is running and CORS is configured correctly.
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {!health && pollStatus !== "error" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 h-28"
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        Skillmate AI Admin Dashboard — polls <code className="font-mono">/health</code> &amp;{" "}
        <code className="font-mono">/metrics</code> every 30s
      </footer>
    </div>
  );
}
