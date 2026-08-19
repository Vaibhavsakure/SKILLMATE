"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import {
  Users, DollarSign, Activity, TrendingUp, Search,
  Shield, ShieldOff, CreditCard, Loader2, AlertTriangle,
  BarChart3, ArrowLeft
} from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";

// ── Types ───────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  email: string;
  role: string;
  credits_remaining: number;
  is_pro: boolean;
  is_banned: boolean;
  created_at: string | null;
  last_active: string | null;
}

interface Analytics {
  total_users: number;
  active_today: number;
  total_revenue_usd: number;
  most_used_feature: string;
  daily_signups: { date: string; count: number }[];
  daily_tool_usage: { date: string; tool_type: string; count: number }[];
  tool_distribution: { tool_type: string; count: number }[];
  top_tools: string[];
  total_analyses: number;
  total_credits_consumed: number;
  avg_score: number;
}

const CHART_COLORS = [
  "#6C5CE7", "#a29bfe", "#00b894", "#fdcb6e",
  "#e17055", "#74b9ff", "#fd79a8", "#55efc4",
];

export default function AdminDashboard() {
  const { token, loading: authLoading } = useAuth();

  // State
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Credit override modal
  const [creditModal, setCreditModal] = useState<{
    userId: string;
    email: string;
    currentBalance: number;
  } | null>(null);
  const [creditNewBalance, setCreditNewBalance] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Fetch analytics ────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingAnalytics(true);
      const { data } = await api.get("/admin/analytics?days=30", { headers });
      setAnalytics(data);
    } catch (err: any) {
      console.error("Analytics fetch failed:", err);
      setError(err?.response?.data?.detail || "Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  }, [token]);

  // ── Fetch users ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (page = 1, search = "") => {
    if (!token) return;
    try {
      setLoadingUsers(true);
      const params = new URLSearchParams({
        page: String(page),
        page_size: "15",
      });
      if (search) params.append("search", search);
      const { data } = await api.get(`/admin/users?${params}`, { headers });
      setUsers(data.users);
      setUsersTotal(data.total);
      setUsersPage(data.page);
      setUsersTotalPages(data.total_pages);
    } catch (err: any) {
      console.error("Users fetch failed:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && !authLoading) {
      fetchAnalytics();
      fetchUsers(1, "");
    }
  }, [token, authLoading, fetchAnalytics, fetchUsers]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, searchQuery);
  };

  const handleCreditOverride = async () => {
    if (!creditModal || !creditNewBalance || !creditReason) return;
    setCreditSubmitting(true);
    try {
      await api.post(
        `/admin/users/${creditModal.userId}/credits`,
        { new_balance: parseInt(creditNewBalance), reason: creditReason },
        { headers },
      );
      setCreditModal(null);
      setCreditNewBalance("");
      setCreditReason("");
      fetchUsers(usersPage, searchQuery);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to update credits");
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleBan = async (userId: string, ban: boolean) => {
    const reason = ban ? prompt("Reason for ban:") : null;
    if (ban && !reason) return;
    try {
      await api.post(
        `/admin/users/${userId}/ban`,
        { banned: ban, reason },
        { headers },
      );
      fetchUsers(usersPage, searchQuery);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to update ban status");
    }
  };

  // ── Transform daily_tool_usage into chart-friendly format ──────────────
  const buildChartData = () => {
    if (!analytics) return [];
    const map = new Map<string, Record<string, number>>();
    analytics.daily_tool_usage.forEach(({ date, tool_type, count }) => {
      if (!map.has(date)) map.set(date, { date: date as any });
      map.get(date)![tool_type] = count;
    });
    return Array.from(map.values());
  };

  const toolTypes = analytics
    ? [...new Set(analytics.daily_tool_usage.map((d) => d.tool_type))]
    : [];

  // ── Loading state ──────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 text-lg">{error}</p>
          <Link href="/dashboard" className="text-purple-400 hover:underline mt-4 block">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-gray-100">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#0f0f1a]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-400" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
                Admin Panel
              </h1>
            </div>
          </div>
          <span className="text-sm text-gray-500">Skillmate AI</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── Stats Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Users",
              value: analytics?.total_users ?? "—",
              icon: Users,
              color: "text-purple-400",
              bg: "from-purple-500/10 to-purple-600/5",
            },
            {
              label: "Total Revenue",
              value: analytics ? `$${analytics.total_revenue_usd.toLocaleString()}` : "—",
              icon: DollarSign,
              color: "text-emerald-400",
              bg: "from-emerald-500/10 to-emerald-600/5",
            },
            {
              label: "Active Today",
              value: analytics?.active_today ?? "—",
              icon: Activity,
              color: "text-blue-400",
              bg: "from-blue-500/10 to-blue-600/5",
            },
            {
              label: "Top Feature",
              value: analytics?.most_used_feature
                ? analytics.most_used_feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "—",
              icon: TrendingUp,
              color: "text-amber-400",
              bg: "from-amber-500/10 to-amber-600/5",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br ${card.bg} p-5`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {loadingAnalytics ? (
                      <span className="inline-block w-16 h-7 bg-white/5 rounded animate-pulse" />
                    ) : (
                      String(card.value)
                    )}
                  </p>
                </div>
                <card.icon className={`w-8 h-8 ${card.color} opacity-60`} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Usage Chart (2/3 width) */}
          <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#12121e] p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Tool Usage — Last 30 Days
            </h2>
            {loadingAnalytics ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={buildChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#666", fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)} /* MM-DD */
                  />
                  <YAxis tick={{ fill: "#666", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a2e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#e0e0e0",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
                  {toolTypes.map((tool, i) => (
                    <Line
                      key={tool}
                      type="monotone"
                      dataKey={tool}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      name={tool.replace(/_/g, " ")}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tool Distribution Pie (1/3 width) */}
          <div className="rounded-xl border border-white/5 bg-[#12121e] p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Feature Distribution
            </h2>
            {loadingAnalytics ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics?.tool_distribution || []}
                    dataKey="count"
                    nameKey="tool_type"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ name, percent }: any) =>
                      `${(name as string).replace(/_/g, " ")} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {(analytics?.tool_distribution || []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a2e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#e0e0e0",
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Users Table ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/5 bg-[#12121e] overflow-hidden">
          <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Users ({usersTotal})
            </h2>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 w-64"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-medium transition"
              >
                Search
              </button>
            </form>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Credits</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Active</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loadingUsers ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 bg-white/5 rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-white/[0.02] transition ${u.is_banned ? "opacity-50" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-gray-200 truncate max-w-[200px]">
                        {u.email}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-purple-500/20 text-purple-300"
                              : u.role === "recruiter"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-gray-300">{u.credits_remaining}</td>
                      <td className="px-5 py-3">
                        {u.is_banned ? (
                          <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
                            <ShieldOff className="w-3 h-3" /> Banned
                          </span>
                        ) : u.is_pro ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            ✦ Pro
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Free</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {u.last_active
                          ? new Date(u.last_active).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right space-x-2">
                        <button
                          onClick={() =>
                            setCreditModal({
                              userId: u.id,
                              email: u.email,
                              currentBalance: u.credits_remaining,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-medium transition"
                          title="Override credits"
                        >
                          <CreditCard className="w-3 h-3" /> Credits
                        </button>
                        {u.role !== "admin" && (
                          <button
                            onClick={() => handleBan(u.id, !u.is_banned)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                              u.is_banned
                                ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                                : "bg-red-600/20 text-red-300 hover:bg-red-600/30"
                            }`}
                          >
                            {u.is_banned ? (
                              <>
                                <Shield className="w-3 h-3" /> Unban
                              </>
                            ) : (
                              <>
                                <ShieldOff className="w-3 h-3" /> Ban
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {usersTotalPages > 1 && (
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Page {usersPage} of {usersTotalPages} · {usersTotal} users
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={usersPage <= 1}
                  onClick={() => fetchUsers(usersPage - 1, searchQuery)}
                  className="px-3 py-1.5 rounded-md bg-white/5 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-30 transition"
                >
                  ← Prev
                </button>
                <button
                  disabled={usersPage >= usersTotalPages}
                  onClick={() => fetchUsers(usersPage + 1, searchQuery)}
                  className="px-3 py-1.5 rounded-md bg-white/5 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-30 transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Credit Override Modal ──────────────────────────────────────── */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Override Credits</h3>
            <p className="text-sm text-gray-400 mb-5">
              User: <span className="text-gray-200">{creditModal.email}</span>
              <br />
              Current Balance:{" "}
              <span className="text-amber-400 font-mono">{creditModal.currentBalance}</span>
            </p>

            <label className="block text-xs text-gray-400 mb-1">New Balance</label>
            <input
              type="number"
              min="0"
              value={creditNewBalance}
              onChange={(e) => setCreditNewBalance(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 mb-4"
              placeholder="e.g. 50"
            />

            <label className="block text-xs text-gray-400 mb-1">Reason</label>
            <input
              type="text"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 mb-6"
              placeholder="e.g. Compensation for outage, Contest winner"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setCreditModal(null)}
                className="px-4 py-2 rounded-lg bg-white/5 text-sm text-gray-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreditOverride}
                disabled={!creditNewBalance || !creditReason || creditSubmitting}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-medium disabled:opacity-50 transition flex items-center gap-2"
              >
                {creditSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Balance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
