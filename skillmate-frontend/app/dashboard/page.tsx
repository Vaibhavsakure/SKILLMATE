"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import {
  FileText, Briefcase, GraduationCap, PenTool, Share2,
  CheckCircle2, TrendingUp, Sparkles, ArrowRight, Zap, Target,
  History, FolderGit2, Map as MapIcon, Loader2, Download
} from "lucide-react";
import { getStatsOverview } from "@/lib/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  total_analyses: number;
  credits_remaining: number;
  avg_score: number;
  tools_used: number;
  recent_tool: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { token, user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
    async function loadData() {
      if (!token || authLoading) return;
      try {
        setUserEmail(authUser?.email || "");

        const data = await getStatsOverview(token);
        setStats(data);

        // Show onboarding for new users
        const onboarded = localStorage.getItem("skillmate-onboarded");
        if (!onboarded && data.total_analyses === 0) {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, authLoading, authUser]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("skillmate-onboarded", "true");
  };

  const statCards = [
    {
      label: "Total Analyses",
      value: stats ? String(stats.total_analyses) : "—",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Credits Remaining",
      value: stats ? String(stats.credits_remaining) : "—",
      icon: Target,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Avg. Score",
      value: stats ? `${stats.avg_score}%` : "—",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  const tools = [
    {
      title: "Resume Builder",
      desc: "Rewrite your resume with AI to match job descriptions perfectly.",
      href: "/dashboard/resumes",
      icon: FileText,
      gradient: "from-blue-500 to-indigo-600",
      shadow: "shadow-blue-200 dark:shadow-blue-900/20",
    },
    {
      title: "ATS Scanner",
      desc: "Check your resume score and get instant improvement tips.",
      href: "/dashboard/ats",
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-teal-600",
      shadow: "shadow-emerald-200 dark:shadow-emerald-900/20",
    },
    {
      title: "Job Match Analyzer",
      desc: "See exactly how well you fit a specific job role.",
      href: "/dashboard/jobs",
      icon: Briefcase,
      gradient: "from-indigo-500 to-violet-600",
      shadow: "shadow-indigo-200 dark:shadow-indigo-900/20",
    },
    {
      title: "Interview Coach",
      desc: "Practice with AI-generated technical and behavioral questions.",
      href: "/dashboard/interview",
      icon: GraduationCap,
      gradient: "from-rose-500 to-pink-600",
      shadow: "shadow-rose-200 dark:shadow-rose-900/20",
    },
    {
      title: "Cover Letter Writer",
      desc: "Draft professional cover letters tailored to the hiring manager.",
      href: "/dashboard/cover-letter",
      icon: PenTool,
      gradient: "from-purple-500 to-fuchsia-600",
      shadow: "shadow-purple-200 dark:shadow-purple-900/20",
    },
    {
      title: "LinkedIn Optimizer",
      desc: "Enhance your profile headline and about section for visibility.",
      href: "/dashboard/linkedin",
      icon: Share2,
      gradient: "from-sky-500 to-cyan-600",
      shadow: "shadow-sky-200 dark:shadow-sky-900/20",
    },
  ];

  return (
    <ErrorBoundary>
    <div className="space-y-10 pb-10">
      {/* Onboarding Wizard (#12) */}
      {showOnboarding && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden animate-in slide-in-from-top-5 fade-in duration-500">
          <button onClick={dismissOnboarding} className="absolute top-4 right-4 text-white/60 hover:text-white text-sm">✕ Dismiss</button>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">👋 Welcome to Skillmate AI!</h2>
            <p className="text-indigo-100 mb-6 max-w-xl">Get started in 3 simple steps to boost your career:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">1️⃣</div>
                <h3 className="font-bold mb-1">Upload Your Resume</h3>
                <p className="text-sm text-indigo-100">Go to Resume Builder and upload your current resume (PDF or DOCX).</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">2️⃣</div>
                <h3 className="font-bold mb-1">Run ATS Scan</h3>
                <p className="text-sm text-indigo-100">Paste a job description and check your match score instantly.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">3️⃣</div>
                <h3 className="font-bold mb-1">Optimize & Apply</h3>
                <p className="text-sm text-indigo-100">Rewrite your resume, generate a cover letter, and ace interviews.</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Link href="/dashboard/resumes" className="bg-white text-indigo-600 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-colors">
                Start with Resume →
              </Link>
              <button onClick={dismissOnboarding} className="text-white/80 hover:text-white px-4 py-2.5 transition-colors">
                I&apos;ll explore on my own
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, <span className="font-semibold text-slate-700 dark:text-slate-300">{userEmail?.split("@")[0] || "User"}</span>! Here&apos;s your career progress.
          </p>
        </div>
        <Link
          href="/dashboard/history"
          className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors shadow-lg shadow-slate-200 dark:shadow-indigo-900/30 flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          View History
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/30 transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              {loading ? (
                <Loader2 className="w-4 h-4 text-slate-300 dark:text-slate-600 animate-spin" />
              ) : (
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Live</span>
              )}
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? (
                <div className="h-9 w-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
              ) : (
                stat.value
              )}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tools Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI-Powered Career Tools</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <Link
              href={tool.href}
              key={i}
              className="group bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 hover:shadow-xl dark:hover:shadow-slate-900/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${tool.gradient}`} />

              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.gradient} text-white shadow-lg ${tool.shadow}`}>
                  <tool.icon className="w-6 h-6" />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2">
                  <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {tool.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                {tool.desc}
              </p>

              <div className="flex items-center text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                LAUNCH TOOL
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Pro Tip Section */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-indigo-950 dark:to-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold mb-2">🚀 Boost your hiring chances by 3x</h3>
            <p className="text-slate-300 max-w-xl">
              Did you know? Tailoring your resume for every single job application increases your interview rate significantly. Use our <strong>Job Match</strong> tool for every application.
            </p>
          </div>
          <Link href="/dashboard/jobs" className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors whitespace-nowrap">
            Analyze Job Match Now
          </Link>
        </div>

        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500 opacity-10 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />
      </div>
    </div>
    </ErrorBoundary>
  );
}