"use client";

/**
 * Skillmate AI — Admin Health Dashboard
 * =======================================
 * Route: /admin/health
 *
 * Polls GET /health and GET /metrics every 30 seconds and renders
 * a live-updating status dashboard with green/red/yellow indicator cards,
 * a Recharts bar chart of AI provider usage, and formatted uptime/error metrics.
 *
 * Protected: redirects non-admin users to /dashboard.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getUserRole } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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
    redis?: ServiceStatus;
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

type CardStatus = "healthy" | "degraded" | "checking";

// ── Constants ────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/python";

const BAR_COLORS: Record<string, string> = {
  Claude: "#8b5cf6",
  Groq: "#f59e0b",
  Ollama: "#06b6d4",
};

// ── Helpers ──────────────────────────────────────────────────────

function resolveStatus(value: string | undefined, isChecking: boolean): CardStatus {
  if (isChecking) return "checking";
  if (!value) return "degraded";
  return ["healthy", "connected", "configured", "ok"].includes(value.toLowerCase())
    ? "healthy"
    : "degraded";
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function errorRateColor(rate: number): string {
  if (rate < 0.01) return "text-emerald-400";
  if (rate < 0.05) return "text-yellow-400";
  return "text-red-400";
}

function errorRateBg(rate: number): string {
  if (rate < 0.01) return "bg-emerald-900/40 border-emerald-500/30";
  if (rate < 0.05) return "bg-yellow-900/40 border-yellow-500/30";
  return "bg-red-900/40 border-red-500/30";
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

// ── Sub-components ───────────────────────────────────────────────

function StatusIndicator({ status }: { status: CardStatus }) {
  const cls =
    status === "healthy"
      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
      : status === "degraded"
        ? "bg-red-500 shadow-[0_0_8px_#f87171]"
        : "bg-yellow-400 shadow-[0_0_8px_#facc15] animate-pulse";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />;
}

function StatusBadge({ status }: { status: CardStatus }) {
  const cls =
    status === "healthy"
      ? "bg-emerald-900/60 text-emerald-300"
      : status === "degraded"
        ? "bg-red-900/60 text-red-300"
        : "bg-yellow-900/60 text-yellow-300";
  const label =
    status === "healthy" ? "OK" : status === "degraded" ? "DEGRADED" : "CHECKING";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function ServiceCard({
  icon,
  title,
  status,
  children,
}: {
  icon: string;
  title: string;
  status: CardStatus;
  children: React.ReactNode;
}) {
  const borderCls =
    status === "healthy"
      ? "border-emerald-500/20 hover:border-emerald-500/40"
      : status === "degraded"
        ? "border-red-500/30 hover:border-red-500/50"
        : "border-yellow-500/20 hover:border-yellow-500/40";
  const glowCls =
    status === "healthy"
      ? "shadow-[inset_0_0_40px_rgba(52,211,153,0.03)]"
      : status === "degraded"
        ? "shadow-[inset_0_0_40px_rgba(248,113,113,0.05)]"
        : "shadow-[inset_0_0_40px_rgba(250,204,21,0.03)]";

  return (
    <div
      className={`rounded-2xl border bg-slate-900/50 p-5 flex flex-col gap-3 transition-all duration-500 ${borderCls} ${glowCls}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <StatusIndicator status={status} />
        <span className="text-sm font-semibold text-slate-200 tracking-wide">
          {title}
        </span>
        <span className="ml-auto">
          <StatusBadge status={status} />
        </span>
      </div>
      <div className="text-sm text-slate-400 space-y-1.5">{children}</div>
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

// Custom Recharts tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-300 text-xs font-semibold">{label}</p>
      <p className="text-white text-sm font-mono">{formatNumber(payload[0].value)} calls</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function AdminHealthPage() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fetchError, setFetchError] = useState(false);

  // ── Admin role gate ────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;

    if (!user || !token) {
      router.replace("/dashboard");
      return;
    }

    // Check role from user_metadata first, then backend
    const metadataRole = user?.user_metadata?.role;
    if (metadataRole === "admin") {
      setAuthorized(true);
      return;
    }

    // Verify via backend API
    getUserRole(token)
      .then((data) => {
        if (data.role === "admin") {
          setAuthorized(true);
        } else {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [user, token, authLoading, router]);

  // ── Fetch both endpoints ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsPolling(true);
    setFetchError(false);
    try {
      const start = performance.now();
      const [healthRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { cache: "no-store" }),
        fetch(`${API_BASE}/metrics`, { cache: "no-store" }),
      ]);
      const latency = Math.round(performance.now() - start);

      const healthJson: HealthData = healthRes.ok
        ? await healthRes.json()
        : {
            status: "unreachable",
            version: "-",
            environment: "-",
            services: {},
            latency_ms: latency,
          };

      const metricsJson: MetricsData | null = metricsRes.ok
        ? await metricsRes.json()
        : null;

      setHealth({ ...healthJson, latency_ms: latency });
      setMetrics(metricsJson);
      setLastChecked(new Date());
      setCountdown(POLL_INTERVAL_MS / 1000);
    } catch {
      setHealth((prev) =>
        prev ? { ...prev, status: "unreachable" } : null,
      );
      setFetchError(true);
      setCountdown(POLL_INTERVAL_MS / 1000);
    } finally {
      setIsPolling(false);
    }
  }, []);

  // ── Polling loop ─────────────────────────────────────────────
  useEffect(() => {
    if (authorized !== true) return;

    fetchAll();
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [authorized, fetchAll]);

  // ── Loading / auth gate ────────────────────────────────────────
  if (authLoading || authorized === null) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Spinner />
          <span className="text-sm">Verifying access...</span>
        </div>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────
  const checking = isPolling && !health;
  const overallOk = health?.status === "healthy";

  const dbStatus = resolveStatus(health?.services.database?.status, checking);
  const redisStatus = resolveStatus(health?.services.redis?.status, checking);
  const claudeStatus = resolveStatus(health?.services.ai?.claude, checking);
  const groqStatus = resolveStatus(health?.services.ai?.groq, checking);
  const ollamaStatus = resolveStatus(health?.services.ai?.ollama, checking);
  const stripeStatus = resolveStatus(health?.services.payments?.stripe, checking);

  const errorRate = metrics?.error_rate ?? 0;

  // Recharts data
  const chartData = metrics
    ? [
        { name: "Claude", calls: metrics.ai_provider_counts.claude },
        { name: "Groq", calls: metrics.ai_provider_counts.groq },
        { name: "Ollama", calls: metrics.ai_provider_counts.ollama },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 font-sans">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full transition-colors duration-500 ${
              health
                ? overallOk
                  ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                  : "bg-red-500 shadow-[0_0_10px_#f87171] animate-pulse"
                : "bg-yellow-400 shadow-[0_0_10px_#facc15] animate-pulse"
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
          {isPolling && (
            <span className="flex items-center gap-1.5">
              <Spinner /> Checking...
            </span>
          )}
          {lastChecked && (
            <span>Last: {lastChecked.toLocaleTimeString()}</span>
          )}
          <button
            onClick={fetchAll}
            disabled={isPolling}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors text-xs font-medium"
            aria-label="Refresh now"
          >
            ↻ Refresh
          </button>
          <span className="text-slate-600">
            Next in{" "}
            <span className="font-mono text-slate-400">{countdown}s</span>
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
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
              {
                label: "UPTIME",
                value: metrics ? formatUptime(metrics.uptime_seconds) : "-",
              },
            ].map(({ label, value }) => (
              <span
                key={label}
                className="px-3 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50"
              >
                <span className="text-slate-600 mr-1.5">{label}</span>
                {value}
              </span>
            ))}
          </div>
        )}

        {/* ── Service status cards (6 cards) ── */}
        <section aria-label="Service status">
          <h2 className="text-xs uppercase tracking-widest text-slate-600 mb-4 font-semibold">
            Service Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Database */}
            <ServiceCard icon="🗄️" title="Database" status={dbStatus}>
              <MetricRow
                label="Status"
                value={health?.services.database?.status ?? "—"}
              />
              <MetricRow
                label="Type"
                value={health?.services.database?.type ?? "—"}
              />
              {dbStatus === "degraded" && health?.services.database?.detail && (
                <p className="text-red-400 text-xs mt-1 break-all">
                  {health.services.database.detail}
                </p>
              )}
            </ServiceCard>

            {/* Redis */}
            <ServiceCard icon="⚡" title="Redis" status={redisStatus}>
              <MetricRow
                label="Status"
                value={health?.services.redis?.status ?? "—"}
              />
              <MetricRow
                label="Role"
                value={health?.services.redis?.type ?? "cache / queue"}
              />
            </ServiceCard>

            {/* Claude AI */}
            <ServiceCard icon="🟣" title="Claude AI" status={claudeStatus}>
              <MetricRow
                label="Status"
                value={health?.services.ai?.claude ?? "—"}
              />
              {metrics && (
                <MetricRow
                  label="Requests"
                  value={formatNumber(metrics.ai_provider_counts.claude)}
                />
              )}
            </ServiceCard>

            {/* Groq AI */}
            <ServiceCard icon="🟡" title="Groq AI" status={groqStatus}>
              <MetricRow
                label="Status"
                value={health?.services.ai?.groq ?? "—"}
              />
              {metrics && (
                <MetricRow
                  label="Requests"
                  value={formatNumber(metrics.ai_provider_counts.groq)}
                />
              )}
            </ServiceCard>

            {/* Ollama */}
            <ServiceCard icon="🔵" title="Ollama" status={ollamaStatus}>
              <MetricRow
                label="Status"
                value={health?.services.ai?.ollama ?? "—"}
              />
              {metrics && (
                <MetricRow
                  label="Requests"
                  value={formatNumber(metrics.ai_provider_counts.ollama)}
                />
              )}
            </ServiceCard>

            {/* Stripe */}
            <ServiceCard icon="💳" title="Stripe" status={stripeStatus}>
              <MetricRow
                label="Status"
                value={health?.services.payments?.stripe ?? "—"}
              />
            </ServiceCard>
          </div>
        </section>

        {/* ── Metrics row: Uptime + Error Rate ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Uptime */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5">
            <h3 className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">
              Uptime
            </h3>
            <p className="text-3xl font-bold text-white font-mono tracking-tight">
              {metrics ? formatUptime(metrics.uptime_seconds) : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              {metrics ? `${formatNumber(metrics.uptime_seconds)} seconds` : ""}
            </p>
          </div>

          {/* Error Rate */}
          <div
            className={`rounded-2xl border p-5 transition-colors duration-500 ${
              metrics ? errorRateBg(metrics.error_rate) : "border-slate-700/50 bg-slate-900/50"
            }`}
          >
            <h3 className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">
              Error Rate
            </h3>
            <p
              className={`text-3xl font-bold font-mono tracking-tight ${
                metrics ? errorRateColor(metrics.error_rate) : "text-white"
              }`}
            >
              {metrics ? `${(metrics.error_rate * 100).toFixed(2)}%` : "—"}
            </p>
            <div className="flex gap-6 mt-2 text-xs text-slate-500">
              <span>
                Errors:{" "}
                <span className="text-slate-300 font-mono">
                  {metrics ? formatNumber(metrics.error_count) : "—"}
                </span>
              </span>
              <span>
                Requests:{" "}
                <span className="text-slate-300 font-mono">
                  {metrics ? formatNumber(metrics.request_count) : "—"}
                </span>
              </span>
            </div>
            {metrics && (
              <p className="text-[10px] mt-2 font-semibold uppercase tracking-wider">
                {metrics.error_rate < 0.01 && (
                  <span className="text-emerald-400">● Healthy — under 1%</span>
                )}
                {metrics.error_rate >= 0.01 && metrics.error_rate < 0.05 && (
                  <span className="text-yellow-400">● Warning — under 5%</span>
                )}
                {metrics.error_rate >= 0.05 && (
                  <span className="text-red-400">● Critical — over 5%</span>
                )}
              </p>
            )}
          </div>
        </section>

        {/* ── AI Provider Usage — Recharts Bar Chart ── */}
        {metrics && (
          <section aria-label="AI provider usage">
            <h2 className="text-xs uppercase tracking-widest text-slate-600 mb-4 font-semibold">
              AI Provider Usage
            </h2>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-xs text-slate-500">
                  Primary provider:{" "}
                  <span className="text-slate-200 font-semibold capitalize">
                    {metrics.ai_provider_used}
                  </span>
                </span>
                <div className="flex gap-3 ml-auto">
                  {Object.entries(BAR_COLORS).map(([name, color]) => (
                    <span key={name} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
                  <Bar dataKey="calls" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={BAR_COLORS[entry.name] ?? "#6366f1"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Summary row below chart */}
              <div className="flex justify-around mt-4 text-center">
                {chartData.map((entry) => {
                  const total = chartData.reduce((a, b) => a + b.calls, 0);
                  const pct = total > 0 ? ((entry.calls / total) * 100).toFixed(1) : "0";
                  return (
                    <div key={entry.name}>
                      <p className="text-lg font-bold text-white font-mono">
                        {formatNumber(entry.calls)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.name} ({pct}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Unreachable / error banner ── */}
        {fetchError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 px-5 py-4 text-sm text-red-300 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            Backend is unreachable. Check that the API server is running and CORS is configured correctly.
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {!health && !fetchError && (
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
