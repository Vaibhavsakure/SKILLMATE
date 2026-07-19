"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScoreComparisonProps {
  scoreBefore: number;
  scoreAfter: number;
  improvement: number;
  keywordsAdded: string[];
  keywordsBefore: number;
  keywordsAfter: number;
  sectionScoresBefore?: Record<string, number>;
  sectionScoresAfter?: Record<string, number>;
}

/* ---------- Animated circular score ring ---------- */
function ScoreRing({
  score,
  label,
  color,
  delay = 0,
  size = 120,
}: {
  score: number;
  label: string;
  color: string;
  delay?: number;
  size?: number;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [strokeDash, setStrokeDash] = useState(0);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Animate number counting up
      const duration = 1200;
      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedScore(Math.round(eased * score));
        setStrokeDash(eased * (score / 100) * circumference);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [score, circumference, delay]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-700"
            strokeWidth="8"
          />
          {/* Animated score arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - strokeDash}
            className="transition-none"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        {/* Score text in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-black tabular-nums"
            style={{ color }}
          >
            {animatedScore}%
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function ScoreComparison({
  scoreBefore,
  scoreAfter,
  improvement,
  keywordsAdded,
  keywordsBefore,
  keywordsAfter,
  sectionScoresBefore,
  sectionScoresAfter,
}: ScoreComparisonProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPositive = improvement > 0;
  const isNeutral = improvement === 0;
  const beforeColor = scoreBefore >= 80 ? "#10b981" : scoreBefore >= 60 ? "#f59e0b" : "#ef4444";
  const afterColor = scoreAfter >= 80 ? "#10b981" : scoreAfter >= 60 ? "#f59e0b" : "#ef4444";

  // Trigger celebration animation for big improvements
  useEffect(() => {
    if (improvement >= 15) {
      const timer = setTimeout(() => setCelebrate(true), 1400);
      return () => clearTimeout(timer);
    }
  }, [improvement]);

  // Section label mapping
  const sectionLabels: Record<string, string> = {
    "Technical Skills": "Technical",
    "Soft Skills": "Soft Skills",
    "Context": "Relevance",
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-lg dark:shadow-slate-900/30"
    >
      {/* Gradient accent bar */}
      <div
        className={`absolute top-0 left-0 w-full h-1.5 ${
          isPositive
            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
            : isNeutral
            ? "bg-gradient-to-r from-amber-400 to-yellow-500"
            : "bg-gradient-to-r from-red-400 to-rose-500"
        }`}
      />

      <div className="p-6 pt-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            ATS Score Comparison
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Powered by keyword-weighted analysis
          </p>
        </div>

        {/* Score Rings */}
        <div className="flex items-center justify-center gap-6 md:gap-10">
          <ScoreRing
            score={scoreBefore}
            label="Before"
            color={beforeColor}
            delay={200}
          />

          {/* Arrow / Delta */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`
              flex items-center justify-center w-12 h-12 rounded-full font-black text-sm
              transition-all duration-500
              ${
                isPositive
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-800"
                  : isNeutral
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 ring-2 ring-amber-200 dark:ring-amber-800"
                  : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-2 ring-red-200 dark:ring-red-800"
              }
              ${celebrate ? "animate-bounce" : ""}
            `}
            >
              {isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : isNeutral ? (
                <Minus className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
            <span
              className={`text-lg font-black tabular-nums ${
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isNeutral
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {improvement}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
              points
            </span>
          </div>

          <ScoreRing
            score={scoreAfter}
            label="After"
            color={afterColor}
            delay={600}
          />
        </div>

        {/* Celebration banner */}
        {celebrate && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {improvement >= 25
                ? "🎉 Incredible improvement!"
                : improvement >= 15
                ? "🚀 Great boost!"
                : ""}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500">
              +{keywordsAdded.length} new keywords matched
            </span>
          </div>
        )}

        {/* Keywords added */}
        {keywordsAdded.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                New Keywords Matched
              </h4>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {keywordsBefore} → {keywordsAfter} total
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywordsAdded.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${800 + i * 80}ms`, animationFillMode: "backwards" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section Breakdown (expandable) */}
        {sectionScoresBefore && sectionScoresAfter && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors w-full justify-center py-1"
            >
              {showDetails ? (
                <>
                  Hide Details <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show Section Breakdown <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            {showDetails && (
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {Object.keys(sectionScoresBefore).map((section) => {
                  const before = sectionScoresBefore[section] || 0;
                  const after = sectionScoresAfter[section] || 0;
                  const delta = after - before;
                  return (
                    <div key={section} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-400">
                          {sectionLabels[section] || section}
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            delta > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : delta < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-slate-400"
                          }`}
                        >
                          {before}% → {after}%
                          {delta !== 0 && (
                            <span className="ml-1">
                              ({delta > 0 ? "+" : ""}
                              {delta})
                            </span>
                          )}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                        {/* Before (faded) */}
                        <div
                          className="absolute inset-y-0 left-0 bg-slate-300 dark:bg-slate-600 rounded-full transition-all duration-700"
                          style={{ width: `${before}%` }}
                        />
                        {/* After (vibrant overlay) */}
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 delay-500 ${
                            after >= 80
                              ? "bg-emerald-500"
                              : after >= 60
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${after}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
