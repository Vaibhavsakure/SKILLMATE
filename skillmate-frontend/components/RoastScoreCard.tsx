"use client";

import React, { useEffect, useState } from "react";
import type { RoastResult } from "@/lib/api";

// ---------------------------------------------------------------------------
//  Animated circular gauge
// ---------------------------------------------------------------------------
function ScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setAnimatedScore(Math.round(eased * score));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const getColor = (s: number) => {
    if (s >= 80) return "#22c55e";
    if (s >= 60) return "#eab308";
    if (s >= 40) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={getColor(animatedScore)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: "stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-slate-800 dark:text-white">
          {animatedScore}
        </span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          / 100
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Category bar
// ---------------------------------------------------------------------------
function CategoryBar({ name, score, emoji, roastLine }: {
  name: string; score: number; emoji: string; roastLine: string;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 300);
    return () => clearTimeout(t);
  }, [score]);

  const barColor =
    score >= 70 ? "bg-emerald-500" :
    score >= 50 ? "bg-yellow-500" :
    score >= 30 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {emoji} {name}
        </span>
        <span className="text-sm font-bold text-slate-800 dark:text-white">{score}%</span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{roastLine}"</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Main Score Card
// ---------------------------------------------------------------------------
export default function RoastScoreCard({ result }: { result: RoastResult }) {
  const [showLines, setShowLines] = useState(0);

  // Typewriter reveal for roast lines
  useEffect(() => {
    if (showLines >= result.roast_lines.length) return;
    const t = setTimeout(() => setShowLines((n) => n + 1), 600);
    return () => clearTimeout(t);
  }, [showLines, result.roast_lines.length]);

  const handleShareTwitter = () => {
    const text = encodeURIComponent(result.share_text);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  const handleShareLinkedIn = () => {
    const text = encodeURIComponent(result.share_text);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://skillmate.ai/dashboard/resume-roast")}&summary=${text}`,
      "_blank",
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(result.share_text);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ── Grade Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-8 text-white shadow-2xl shadow-red-500/20">
        {/* Fire particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-yellow-300/40 animate-pulse"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${1.5 + i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <ScoreGauge score={result.overall_score} />
          <div className="text-center md:text-left flex-1">
            <div className="text-5xl mb-2">{result.roast_emoji}</div>
            <h2 className="text-2xl md:text-3xl font-black mb-2">
              {result.roast_grade}
            </h2>
            <p className="text-lg text-white/90 font-medium leading-snug">
              {result.headline}
            </p>
            {result.ats_score > 0 && (
              <p className="mt-3 text-sm text-white/70">
                Real ATS Score: <span className="font-bold text-white">{result.ats_score}%</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Roast Lines ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          🎤 The Roast
        </h3>
        <div className="space-y-3">
          {result.roast_lines.map((line, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 transition-all duration-500 ${
                i < showLines
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <span className="shrink-0 w-7 h-7 rounded-full bg-red-100 dark:bg-red-950/50 text-red-500 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">
                {line}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Category Breakdown ───────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
          📊 Category Breakdown
        </h3>
        <div className="space-y-5">
          {result.category_scores.map((cat, i) => (
            <CategoryBar
              key={i}
              name={cat.name}
              score={cat.score}
              emoji={cat.emoji}
              roastLine={cat.roast_line}
            />
          ))}
        </div>
      </div>

      {/* ── Real Talk (helpful tips) ─────────────────────────── */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-4 flex items-center gap-2">
          💡 Real Talk — How to Actually Fix This
        </h3>
        <div className="space-y-3">
          {result.real_talk.map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                ✓
              </span>
              <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
                {tip}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Share + CTA ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
        <button
          onClick={handleShareTwitter}
          className="flex items-center gap-2 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Share on X
        </button>
        <button
          onClick={handleShareLinkedIn}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] text-white rounded-xl text-sm font-semibold hover:bg-[#084d94] transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          Share on LinkedIn
        </button>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          📋 Copy Result
        </button>
      </div>
    </div>
  );
}
