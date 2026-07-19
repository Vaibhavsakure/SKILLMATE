"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import {
  enhanceBullet,
  enhanceAllBullets,
  type EnhancedBullet,
} from "@/lib/api";
import {
  Diamond,
  Sparkles,
  Plus,
  Trash2,
  Zap,
  ArrowRight,
  Check,
  X,
  Copy,
  TrendingUp,
  Target,
  Award,
  ChevronDown,
  Briefcase,
  Loader2,
  RotateCcw,
} from "lucide-react";
import ContextBanner from "@/components/ContextBanner";

/* ─── Impact Ring SVG ─── */
function ImpactRing({ score, size = 56, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / 10;
  const color =
    score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
          className="text-slate-200 dark:text-slate-700" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={4} strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color, lineHeight: `${size}px`, width: size, textAlign: "center" }}>
        {score}
      </span>
      {label && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>}
    </div>
  );
}

/* ─── Category Badge ─── */
const CAT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  metrics: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", label: "📊 Metrics" },
  verb_upgrade: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "⚡ Verb Upgrade" },
  specificity: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", label: "🎯 Specificity" },
  quantification: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "📈 Quantification" },
};

/* ─── Enhanced Result Card ─── */
function ResultCard({
  item,
  index,
  onAccept,
  onReject,
  accepted,
}: {
  item: EnhancedBullet;
  index: number;
  onAccept: (i: number) => void;
  onReject: (i: number) => void;
  accepted: boolean | null;
}) {
  const [copied, setCopied] = useState(false);
  const cat = CAT_STYLES[item.category] || CAT_STYLES.metrics;
  const improvement = item.impact_score_after - item.impact_score_before;

  const handleCopy = () => {
    navigator.clipboard.writeText(item.enhanced);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
      accepted === true ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20" :
      accepted === false ? "border-red-200 dark:border-red-800 opacity-50" :
      "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800"
    }`}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{index + 1}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>
            {cat.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className="text-red-400">{item.impact_score_before}</span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span className="text-emerald-500">{item.impact_score_after}</span>
          <span className="text-emerald-500 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-md text-[10px]">
            +{improvement}
          </span>
        </div>
      </div>

      {/* Before */}
      <div className="px-5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1.5">Before</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-through decoration-red-300/50">
          {item.original}
        </p>
      </div>

      {/* After */}
      <div className="px-5 py-3 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/20 dark:to-transparent border-y border-slate-100 dark:border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1.5">After ✨</p>
        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
          {item.enhanced}
        </p>
        {/* Metrics chips */}
        {item.metrics_added.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.metrics_added.map((m, i) => (
              <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reasoning */}
      <div className="px-5 py-2.5">
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">💡 {item.reasoning}</p>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex items-center gap-2">
        {accepted === null ? (
          <>
            <button onClick={() => onAccept(index)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-all shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30">
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button onClick={() => onReject(index)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
              <X className="h-3.5 w-3.5" /> Reject
            </button>
            <button onClick={handleCopy}
              className="ml-auto flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-indigo-500 transition-colors">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        ) : accepted ? (
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Accepted
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <X className="h-4 w-4" /> Rejected
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Stats Banner ─── */
function StatsBanner({ results }: { results: EnhancedBullet[] }) {
  if (results.length === 0) return null;
  const avgBefore = results.reduce((s, r) => s + r.impact_score_before, 0) / results.length;
  const avgAfter = results.reduce((s, r) => s + r.impact_score_after, 0) / results.length;
  const totalMetrics = results.reduce((s, r) => s + r.metrics_added.length, 0);

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[
        { icon: <TrendingUp className="h-5 w-5" />, label: "Avg Improvement", value: `+${(avgAfter - avgBefore).toFixed(1)}`, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
        { icon: <Target className="h-5 w-5" />, label: "Avg Impact Score", value: `${avgAfter.toFixed(1)}/10`, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
        { icon: <Award className="h-5 w-5" />, label: "Metrics Added", value: `${totalMetrics}`, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
      ].map((stat) => (
        <div key={stat.label} className={`${stat.bg} rounded-xl p-4 text-center border border-slate-100 dark:border-slate-800`}>
          <div className={`${stat.color} flex justify-center mb-2`}>{stat.icon}</div>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════ MAIN PAGE ═══════════════════ */
export default function EnhancePage() {
  const { getToken } = useAuth();
  const { jobDescription, hasJD } = useGlobalResume();

  // Input state
  const [bullets, setBullets] = useState<string[]>([""]);
  const [jobContext, setJobContext] = useState("");
  const [tone, setTone] = useState("professional");
  const [showJobContext, setShowJobContext] = useState(false);

  // Output state
  const [results, setResults] = useState<EnhancedBullet[]>([]);
  const [acceptedMap, setAcceptedMap] = useState<Record<number, boolean | null>>({});
  const [loading, setLoading] = useState(false);
  const [enhancingIndex, setEnhancingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Bullet CRUD
  const addBullet = () => setBullets((b) => [...b, ""]);
  const removeBullet = (i: number) => setBullets((b) => b.filter((_, idx) => idx !== i));
  const updateBullet = (i: number, val: string) =>
    setBullets((b) => b.map((v, idx) => (idx === i ? val : v)));

  // Enhance single bullet
  const handleEnhanceSingle = async (index: number) => {
    const bullet = bullets[index]?.trim();
    if (!bullet) return;
    setEnhancingIndex(index);
    setError("");
    try {
      const token = await getToken();
      const resp = await enhanceBullet(
        { bullet, job_context: jobContext || undefined, tone },
        token
      );
      setResults((prev) => {
        const next = [...prev];
        next[index] = resp.result;
        return next;
      });
      setAcceptedMap((prev) => ({ ...prev, [index]: null }));
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Enhancement failed");
    } finally {
      setEnhancingIndex(null);
    }
  };

  // Enhance all bullets at once
  const handleEnhanceAll = async () => {
    const validBullets = bullets.filter((b) => b.trim().length > 0);
    if (validBullets.length === 0) { setError("Add at least one bullet point."); return; }
    setLoading(true);
    setError("");
    setResults([]);
    setAcceptedMap({});
    try {
      const token = await getToken();
      const resp = await enhanceAllBullets(
        { bullets: validBullets, job_context: jobContext || undefined, tone },
        token
      );
      setResults(resp.results);
      const map: Record<number, null> = {};
      resp.results.forEach((_, i) => { map[i] = null; });
      setAcceptedMap(map);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Enhancement failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (i: number) => setAcceptedMap((m) => ({ ...m, [i]: true }));
  const handleReject = (i: number) => setAcceptedMap((m) => ({ ...m, [i]: false }));
  const handleReset = () => { setResults([]); setAcceptedMap({}); setError(""); };

  const handleCopyAll = () => {
    const accepted = results.filter((_, i) => acceptedMap[i] !== false);
    const text = accepted.map((r) => `• ${r.enhanced}`).join("\n");
    navigator.clipboard.writeText(text);
  };

  const validCount = bullets.filter((b) => b.trim().length > 0).length;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* ─── Header ─── */}
      <div className="flex items-start gap-4 mb-8">
        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-3.5 rounded-2xl shadow-lg shadow-violet-200 dark:shadow-violet-900/40">
          <Diamond className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            AI Achievement Extractor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-lg">
            Transform weak resume bullets into quantified power statements. Add metrics, impact verbs, and business results with one click.
          </p>
        </div>
      </div>

      {/* Global Context Banner */}
      <ContextBanner variant="compact" showResume={false} className="mb-2" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ─── LEFT: Input Panel ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Bullet inputs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" /> Your Bullet Points
            </h3>
            <div className="space-y-3">
              {bullets.map((b, i) => (
                <div key={i} className="flex gap-2 group">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-300 dark:text-slate-600">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={b}
                      onChange={(e) => updateBullet(i, e.target.value)}
                      placeholder="e.g. Built APIs for the project"
                      className="w-full pl-8 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                  {/* Per-bullet enhance */}
                  <button
                    onClick={() => handleEnhanceSingle(i)}
                    disabled={!b.trim() || enhancingIndex === i}
                    className="px-2.5 py-2 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Enhance this bullet"
                  >
                    {enhancingIndex === i ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                  </button>
                  {bullets.length > 1 && (
                    <button onClick={() => removeBullet(i)}
                      className="px-2 py-2 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addBullet}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Another Bullet
            </button>
          </div>

          {/* Job Context (collapsible) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <button onClick={() => setShowJobContext(!showJobContext)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-slate-400" /> Job Context
                <span className="text-[10px] font-normal text-slate-400">(optional)</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showJobContext ? "rotate-180" : ""}`} />
            </button>
            {showJobContext && (
              <div className="px-5 pb-4 space-y-2">
                {hasJD && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✅ Using global JD ({jobDescription.length.toLocaleString()} chars). Override below if needed:</p>
                )}
                <textarea
                  value={jobContext || (hasJD ? jobDescription : "")}
                  onChange={(e) => setJobContext(e.target.value)}
                  placeholder="Paste job description for contextual enhancement..."
                  className="w-full h-28 p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 resize-none placeholder:text-slate-300"
                />
              </div>
            )}
          </div>

          {/* Tone selector */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Tone</h3>
            <div className="grid grid-cols-3 gap-2">
              {["professional", "confident", "technical"].map((t) => (
                <button key={t} onClick={() => setTone(t)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    tone === t
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200 dark:shadow-violet-900/40"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Enhance All Button */}
          <button
            onClick={handleEnhanceAll}
            disabled={loading || validCount === 0}
            className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.98] shadow-lg ${
              loading
                ? "bg-violet-400 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-violet-200 dark:shadow-violet-900/40"
            }`}>
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Enhancing {validCount} Bullet{validCount > 1 ? "s" : ""}...</>
            ) : (
              <><Diamond className="h-5 w-5" /> Enhance All ({validCount})</>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}
        </div>

        {/* ─── RIGHT: Results Panel ─── */}
        <div className="lg:col-span-3">
          {results.length > 0 ? (
            <div>
              {/* Stats */}
              <StatsBanner results={results} />

              {/* Action bar */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Enhanced Bullets ({results.length})
                </h3>
                <div className="flex gap-2">
                  <button onClick={handleCopyAll}
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">
                    <Copy className="h-3.5 w-3.5" /> Copy Accepted
                  </button>
                  <button onClick={handleReset}
                    className="text-xs font-medium text-slate-500 hover:text-red-500 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>
              </div>

              {/* Result Cards */}
              <div className="space-y-4">
                {results.map((item, i) => (
                  <ResultCard
                    key={i}
                    item={item}
                    index={i}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    accepted={acceptedMap[i] ?? null}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="h-full flex items-center justify-center min-h-[500px]">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-950/50 dark:to-fuchsia-950/50 flex items-center justify-center">
                  <Diamond className="h-10 w-10 text-violet-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Your enhanced bullets appear here
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Add your resume bullets on the left, then click{" "}
                  <Zap className="inline h-3.5 w-3.5 text-violet-500" /> to enhance individually
                  or use <strong>Enhance All</strong> for batch processing.
                </p>
                <div className="space-y-3 text-left bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Example Transform</p>
                  <p className="text-sm text-red-400 line-through">&quot;Worked on APIs for a web project&quot;</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    &quot;Architected RESTful APIs serving <strong>50K RPM</strong>, reducing response latency by <strong>40%</strong> across 3 microservices&quot;
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
