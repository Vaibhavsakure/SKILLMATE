"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import {
  generateLearningPath,
  type LearningPathResponse,
  type LearningPathSkillGap,
} from "@/lib/api";
import {
  Route,
  BookOpen,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  AlertCircle,
  Flag,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// ── Types ───────────────────────────────────────────────────────────────

interface PhaseProgress {
  [skill: string]: boolean;
}

const STORAGE_KEY = "skillmate-learning-path-progress";

// ── Helpers ─────────────────────────────────────────────────────────────

function loadProgress(): PhaseProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: PhaseProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function priorityColor(p: string) {
  switch (p) {
    case "high":
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }
}

function levelBadge(level: string) {
  const colors: Record<string, string> = {
    none: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    beginner: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    intermediate: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
    advanced: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    expert: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  };
  return colors[level] || colors.none;
}

function resourceIcon(type: string) {
  switch (type) {
    case "free":
      return "🆓";
    case "paid":
      return "💰";
    case "certification":
      return "📜";
    default:
      return "📖";
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function LearningPathPage() {
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState<LearningPathResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<PhaseProgress>({});
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  const { getToken } = useAuth();
  const { resumeText, hasResume } = useGlobalResume();

  // Load progress from localStorage
  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // Auto-expand all phases when results arrive
  useEffect(() => {
    if (result) {
      setExpandedPhases(new Set(result.skill_gaps.map((_, i) => i)));
    }
  }, [result]);

  const togglePhase = (index: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleComplete = (skill: string) => {
    setProgress((prev) => {
      const next = { ...prev, [skill]: !prev[skill] };
      saveProgress(next);
      return next;
    });
  };

  const completedCount = result
    ? result.skill_gaps.filter((g) => progress[g.skill]).length
    : 0;
  const totalPhases = result?.skill_gaps.length ?? 0;
  const progressPercent = totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0;

  // ── Generate ──────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!targetRole.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in to generate a learning path");

      const data = await generateLearningPath(
        {
          target_role: targetRole,
          resume_text: hasResume ? resumeText : undefined,
        },
        token,
      );
      setResult(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err.message ||
        "Failed to generate learning path. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  // ── Order skill_gaps by recommended_order ─────────────────────────────

  const orderedGaps: LearningPathSkillGap[] = result
    ? result.recommended_order
        .map((name) => result.skill_gaps.find((g) => g.skill === name))
        .filter(Boolean) as LearningPathSkillGap[]
    : [];

  // Fallback: if recommended_order doesn't cover all, append the rest
  if (result) {
    const ordered = new Set(result.recommended_order);
    result.skill_gaps.forEach((g) => {
      if (!ordered.has(g.skill)) orderedGaps.push(g);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 dark:bg-indigo-950/50 p-3 rounded-xl">
          <Route className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Learning Path
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Discover your skill gaps and get a curated study plan with real resources.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-role">Target Role</Label>
            <Input
              id="target-role"
              placeholder="e.g. Senior Frontend Engineer, Data Scientist, DevOps Lead"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            />
          </div>

          {/* Resume status */}
          <div
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              hasResume
                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
            }`}
          >
            {hasResume ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your resume is loaded — results will be personalised to your experience.
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                No resume detected. Upload one via the sidebar for personalised results.
              </>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !targetRole.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-medium"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span> Analyzing Skill Gaps...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Generate Learning Path
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader />
          <p className="text-slate-500 dark:text-slate-400 mt-4 animate-pulse">
            Analyzing skills and curating resources...
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Banner */}
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-xl text-center">
            <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-200 mb-2">
              🎯 Goal: {targetRole}
            </h2>
            <p className="text-indigo-700 dark:text-indigo-300 italic">
              &ldquo;{result.role_summary}&rdquo;
            </p>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <Clock className="w-4 h-4" />
                ~{result.total_estimated_weeks} weeks total
              </span>
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <BookOpen className="w-4 h-4" />
                {result.skill_gaps.length} skills to learn
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Your Progress
              </h3>
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400">
                {completedCount}/{totalPhases} phases
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progressPercent === 100 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 text-center font-medium animate-pulse">
                🎉 Congratulations! You&apos;ve completed all phases!
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="relative border-l-4 border-indigo-200 dark:border-indigo-900 ml-4 md:ml-6 space-y-6 pl-8 py-2">
            {orderedGaps.map((gap, index) => {
              const isComplete = progress[gap.skill] || false;
              const isExpanded = expandedPhases.has(index);

              return (
                <div key={gap.skill} className="relative group">
                  {/* Timeline Dot */}
                  <button
                    onClick={() => toggleComplete(gap.skill)}
                    className={`absolute -left-[45px] top-0 rounded-full h-10 w-10 flex items-center justify-center shadow-sm z-10 transition-all duration-300 cursor-pointer hover:scale-110 ${
                      isComplete
                        ? "bg-emerald-500 text-white border-4 border-emerald-300 dark:border-emerald-800"
                        : "bg-white dark:bg-slate-800 border-4 border-indigo-500 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    }`}
                    title={isComplete ? "Mark incomplete" : "Mark complete"}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="font-bold text-sm">{index + 1}</span>
                    )}
                  </button>

                  {/* Phase Card */}
                  <Card
                    className={`transition-all duration-300 ${
                      isComplete
                        ? "opacity-60 border-emerald-200 dark:border-emerald-900/50"
                        : "hover:shadow-md border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <CardHeader
                      className="pb-2 cursor-pointer select-none"
                      onClick={() => togglePhase(index)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle
                            className={`text-lg font-bold ${
                              isComplete
                                ? "line-through text-slate-400 dark:text-slate-500"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            Phase {index + 1}: {gap.skill}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span
                              className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor(
                                gap.priority,
                              )}`}
                            >
                              <Target className="w-3 h-3 mr-1" />
                              {gap.priority} priority
                            </span>
                            <span className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 mr-1" />
                              ~{gap.estimated_hours}h
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Level progression */}
                        <div className="flex items-center gap-2 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelBadge(
                              gap.current_level,
                            )}`}
                          >
                            {gap.current_level || "none"}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelBadge(
                              gap.target_level,
                            )}`}
                          >
                            {gap.target_level}
                          </span>
                        </div>

                        {/* Resources */}
                        {gap.resources.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
                              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                              Recommended Resources
                            </p>
                            <div className="space-y-2.5">
                              {gap.resources.map((res, ri) => (
                                <a
                                  key={ri}
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all group"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-lg flex-shrink-0">
                                      {resourceIcon(res.type)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {res.name}
                                      </p>
                                      <p className="text-xs text-slate-400 dark:text-slate-500">
                                        {res.platform} · {res.type}
                                      </p>
                                    </div>
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mark complete button */}
                        <button
                          onClick={() => toggleComplete(gap.skill)}
                          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                            isComplete
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                          }`}
                        >
                          {isComplete ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Completed ✓
                            </>
                          ) : (
                            <>
                              <Circle className="w-4 h-4" /> Mark as Complete
                            </>
                          )}
                        </button>
                      </CardContent>
                    )}
                  </Card>
                </div>
              );
            })}

            {/* Final Flag */}
            <div className="relative">
              <div
                className={`absolute -left-[45px] top-0 rounded-full h-10 w-10 flex items-center justify-center shadow-md z-10 ${
                  progressPercent === 100
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                }`}
              >
                <Flag className="h-5 w-5" />
              </div>
              <div className="text-slate-400 dark:text-slate-500 text-sm py-2 italic ml-2">
                {progressPercent === 100
                  ? "🎉 All phases complete — you're ready to apply!"
                  : "Complete all phases to reach your goal."}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setResult(null);
                setTargetRole("");
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Generate Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
