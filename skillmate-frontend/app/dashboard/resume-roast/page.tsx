"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { roastResume, type RoastResult } from "@/lib/api";
import RoastScoreCard from "@/components/RoastScoreCard";
import ResumeUploader from "@/components/ResumeUploader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Flame, Upload, Briefcase, ArrowRight, Loader2, AlertCircle, Sparkles,
} from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
//  Fire loading animation
// ---------------------------------------------------------------------------
function RoastingAnimation() {
  const flames = ["🔥", "🍳", "🥩", "🌶️", "💀"];
  const [idx, setIdx] = useState(0);
  const messages = [
    "Warming up the roast oven...",
    "Reading your resume with judgment...",
    "Counting buzzwords...",
    "Measuring the fluff levels...",
    "Preparing the verdict...",
  ];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % flames.length), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="text-7xl animate-bounce">{flames[idx]}</div>
        <div className="absolute -inset-4 bg-orange-500/10 rounded-full blur-2xl animate-pulse" />
      </div>
      <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 animate-pulse">
        {messages[idx]}
      </p>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        This takes 5-10 seconds
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Main Page
// ---------------------------------------------------------------------------
export default function ResumeRoastPage() {
  return (
    <ErrorBoundary>
      <ResumeRoastInner />
    </ErrorBoundary>
  );
}

function ResumeRoastInner() {
  const { getToken } = useAuth();
  const {
    resumeText: globalResume,
    jobDescription: globalJD,
    hasResume,
    hasJD,
  } = useGlobalResume();

  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJD, setShowJD] = useState(false);
  const [isRoasting, setIsRoasting] = useState(false);
  const [result, setResult] = useState<RoastResult | null>(null);
  const [error, setError] = useState("");

  // Pre-populate from global context
  useEffect(() => {
    if (hasResume && !resumeText) setResumeText(globalResume);
  }, [hasResume, globalResume]);
  useEffect(() => {
    if (hasJD && !jobDescription) setJobDescription(globalJD);
  }, [hasJD, globalJD]);

  const handleRoast = async () => {
    if (!resumeText.trim() || resumeText.trim().length < 50) {
      setError("Paste at least 50 characters of resume content. We need something to roast!");
      return;
    }
    setError("");
    setIsRoasting(true);
    setResult(null);

    try {
      const token = await getToken();
      const data = await roastResume(
        {
          resume_text: resumeText,
          job_description: showJD ? jobDescription : undefined,
        },
        token,
      );
      setResult(data);
    } catch (err: any) {
      console.error("Roast failed:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "The roast oven malfunctioned. Try again.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setIsRoasting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-semibold">
          <Flame className="h-4 w-4" />
          New Feature
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          🔥 Roast My Resume
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Get brutally honest, AI-powered feedback on your resume.
          Think Gordon Ramsay, but for CVs. Savage but helpful.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> AI-Powered
          </span>
          <span>•</span>
          <span>Uses 1 Credit</span>
          <span>•</span>
          <span>Shareable Results</span>
        </div>
      </div>

      {/* ── Results (shown after roast) ──────────────────────── */}
      {result && (
        <div className="space-y-6">
          <RoastScoreCard result={result} />

          {/* CTA to fix resume */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-8">
            <Link
              href="/rewrite"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Sparkles className="h-4 w-4" />
              Fix My Resume with AI
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => { setResult(null); setError(""); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              🔥 Roast Again
            </button>
          </div>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────── */}
      {isRoasting && <RoastingAnimation />}

      {/* ── Input form (hidden during roast and after results) ─ */}
      {!isRoasting && !result && (
        <div className="space-y-6">
          {/* Resume input */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-slate-400" />
                Your Resume
              </h2>
              {resumeText.length > 0 && (
                <span className="text-xs text-slate-400">
                  {resumeText.length.toLocaleString()} chars
                </span>
              )}
            </div>

            {/* File upload component */}
            <ResumeUploader
              onTextExtracted={(text) => setResumeText(text)}
              className="mb-4"
            />

            {/* Text area for paste / preview */}
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Or paste your resume content here..."
              rows={8}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
            />

            {hasResume && resumeText === globalResume && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                ✓ Using your saved resume
              </p>
            )}
          </div>

          {/* Optional JD toggle */}
          <div>
            <button
              onClick={() => setShowJD(!showJD)}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Briefcase className="h-3.5 w-3.5" />
              {showJD ? "Hide job description" : "Add job description for targeted roast (optional)"}
            </button>

            {showJD && (
              <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  Job Description
                  <span className="text-xs font-normal text-slate-400">(optional)</span>
                </h2>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here for a targeted roast..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
                />
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Roast button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleRoast}
              disabled={!resumeText.trim() || isRoasting}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white rounded-2xl text-lg font-black shadow-xl shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Flame className="h-6 w-6 group-hover:animate-bounce" />
              Roast My Resume
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full shadow-sm">
                1 CREDIT
              </span>
            </button>
          </div>

          {/* Social proof */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
            ⚡ Over 10,000 resumes roasted. Savage but helpful.
          </p>
        </div>
      )}
    </div>
  );
}
