"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Target,
  FileText,
  Mic,
  Linkedin,
  Map,
  Upload,
  Brain,
  Rocket,
  CheckCircle2,
  Star,
  ChevronDown,
  Zap,
  Shield,
  Users,
} from "lucide-react";

// ── FAQ Data ─────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What is an ATS, and why does it matter?",
    a: "An Applicant Tracking System (ATS) is software that companies use to automatically screen resumes before a human ever sees them. Studies show 75% of resumes are rejected by ATS before reaching a recruiter. Skillmate AI analyzes your resume against the job description and gives you an exact score and fix list so you always pass the first gate.",
  },
  {
    q: "How many free credits do I get?",
    a: "Every new account starts with 50 free AI calls per month — enough to run multiple ATS scans, rewrite your resume for 2–3 jobs, and generate a cover letter. Credits reset on the 1st of each month.",
  },
  {
    q: "Does Skillmate store my resume data?",
    a: "Your resume is processed in-memory and stored encrypted only if you explicitly save it to your account. We never sell or share your personal data with third parties. You can delete your account and all associated data at any time.",
  },
  {
    q: "Which AI models power Skillmate?",
    a: "Skillmate uses a multi-model routing strategy — Claude 3.5 Sonnet for nuanced resume rewriting and interview coaching, Groq (Llama 3) for ultra-fast ATS scoring, and a local Ollama fallback for privacy-first processing. The best model is selected automatically per task.",
  },
  {
    q: "Can I cancel my Pro subscription anytime?",
    a: "Yes — no lock-in, no cancellation fees. Cancel from your dashboard settings and you retain Pro access until the end of your billing period. After that you revert to the Free tier with 50 credits/month.",
  },
];

// ── Features ─────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Target,
    color: "from-pink-500 to-rose-600",
    glow: "group-hover:shadow-pink-500/20",
    title: "ATS Scanner",
    desc: "Instant compatibility score against any job description. Know exactly which keywords are missing before you apply.",
  },
  {
    icon: Sparkles,
    color: "from-violet-500 to-indigo-600",
    glow: "group-hover:shadow-violet-500/20",
    title: "Resume Rewriter",
    desc: "AI rewrites your resume to match the job — adjusting tone, keywords, and impact bullets. Before/after ATS score included.",
  },
  {
    icon: Mic,
    color: "from-sky-500 to-cyan-600",
    glow: "group-hover:shadow-sky-500/20",
    title: "AI Interview Coach",
    desc: "Practice real interview questions with live AI feedback on your answers. Score, follow-ups, and improvement tips.",
  },
  {
    icon: FileText,
    color: "from-emerald-500 to-teal-600",
    glow: "group-hover:shadow-emerald-500/20",
    title: "Cover Letter",
    desc: "Generate role-specific, personalized cover letters in seconds. Weave your story into the company's mission.",
  },
  {
    icon: Linkedin,
    color: "from-blue-500 to-blue-700",
    glow: "group-hover:shadow-blue-500/20",
    title: "LinkedIn Optimizer",
    desc: "Rewrite your headline, summary, and about section to attract recruiters searching for your exact skills.",
  },
  {
    icon: Map,
    color: "from-amber-500 to-orange-600",
    glow: "group-hover:shadow-amber-500/20",
    title: "Career Roadmap",
    desc: "Get a personalized 90-day learning plan with resources, milestones, and skill gaps ranked by hiring priority.",
  },
];

// ── Steps ─────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    icon: Upload,
    color: "text-violet-400",
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/10",
    title: "Upload Your Resume",
    desc: "Drop in your PDF or DOCX, or paste raw text. We extract and understand your full work history instantly.",
  },
  {
    num: "02",
    icon: Brain,
    color: "text-sky-400",
    ring: "ring-sky-500/30",
    bg: "bg-sky-500/10",
    title: "Get AI Analysis",
    desc: "Our multi-model AI scores, rewrites, and optimizes your resume against the job description in under 10 seconds.",
  },
  {
    num: "03",
    icon: Rocket,
    color: "text-emerald-400",
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    title: "Apply with Confidence",
    desc: "Download your optimized resume, tailored cover letter, and interview prep kit — ready to apply immediately.",
  },
];

// ── Pricing ───────────────────────────────────────────────────────

const FREE_FEATURES = [
  "50 AI calls per month",
  "ATS Scanner",
  "Resume Rewriter (3/month)",
  "Cover Letter Generator",
  "Interview Coach (5 sessions)",
  "Career Roadmap",
];

const PRO_FEATURES = [
  "500 AI calls per month",
  "Everything in Free",
  "Unlimited Resume Rewrites",
  "LinkedIn Profile Optimizer",
  "X-Ray ATS Semantic Analyzer",
  "LaTeX Resume Builder",
  "Priority AI (Claude 3.5 Sonnet)",
  "Priority support",
];

// ── Component ─────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-800 rounded-2xl overflow-hidden transition-colors duration-200 hover:border-slate-700">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-slate-100 font-medium text-sm sm:text-base">{q}</span>
        <ChevronDown
          className={`flex-shrink-0 h-5 w-5 text-slate-400 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="px-6 pb-5 text-slate-400 text-sm leading-7">{a}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080c18] text-slate-100 font-sans overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#080c18]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5 font-bold text-white text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30">
              <Sparkles className="h-4 w-4" />
            </div>
            Skillmate AI
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:opacity-90 transition-opacity"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── 1. Hero ── */}
        <section className="relative overflow-hidden pt-20 pb-32 sm:pt-28 sm:pb-40">
          {/* Background glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-violet-600/10 blur-3xl" />
            <div className="absolute top-20 left-0 w-80 h-80 rounded-full bg-indigo-600/8 blur-3xl" />
            <div className="absolute top-10 right-0 w-80 h-80 rounded-full bg-pink-600/8 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300 mb-8">
              <Zap className="h-3.5 w-3.5 fill-violet-400 text-violet-400" />
              Powered by Claude · Groq · Multi-LLM AI
            </div>

            <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]">
              Land Your Dream Job{" "}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Faster with AI
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Skillmate AI rewrites your resume, scores it against ATS systems, coaches
              you for interviews, and generates cover letters — all in under 60 seconds.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                id="hero-cta-try-free"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-violet-500/25 hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-auto justify-center"
              >
                Try Free — No Card Needed
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/rewrite"
                id="hero-cta-demo"
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-8 py-4 text-base font-semibold text-slate-200 hover:bg-slate-700 hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-auto justify-center"
              >
                See Demo
              </Link>
            </div>

            {/* Micro-stats */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { value: "12+", label: "Career Tools" },
                { value: "~5hrs", label: "Saved per App" },
                { value: "Multi-LLM", label: "AI Models" },
                { value: "Real-time", label: "ATS Analysis" },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-5 text-center"
                >
                  <div className="text-2xl font-bold text-white">{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 2. Social Proof Bar ── */}
        <section className="border-y border-slate-800 bg-slate-900/40 py-6">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                <Users className="h-4 w-4 text-violet-400 flex-shrink-0" />
                Join{" "}
                <span className="font-bold text-white">1,000+ job seekers</span>{" "}
                already landing more interviews
              </div>
              <div className="hidden sm:block h-6 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-400 text-sm">
                  SOC 2 compliant · Data never sold
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Features Grid ── */}
        <section id="features" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Everything you need to get hired
              </h2>
              <p className="mt-4 text-slate-400 max-w-xl mx-auto text-lg">
                Stop guessing keywords. Our AI handles the technical optimization
                so you can focus on what matters — the interview.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon: Icon, color, glow, title, desc }) => (
                <div
                  key={title}
                  className={`group relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${glow}`}
                >
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} mb-4 shadow-lg`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-6">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. How it Works ── */}
        <section id="how-it-works" className="py-24 sm:py-32 border-t border-slate-800/60">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                From resume to hired in 3 steps
              </h2>
              <p className="mt-4 text-slate-400 max-w-lg mx-auto">
                No setup. No learning curve. Just paste your resume and job description.
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-12 left-[calc(16.666%+2rem)] right-[calc(16.666%+2rem)] h-px bg-gradient-to-r from-violet-500/40 via-slate-600 to-emerald-500/40" />

              {STEPS.map(({ num, icon: Icon, color, ring, bg, title, desc }) => (
                <div key={num} className="flex flex-col items-center text-center">
                  <div
                    className={`relative flex h-24 w-24 items-center justify-center rounded-2xl ${bg} ring-1 ${ring} mb-6`}
                  >
                    <Icon className={`h-9 w-9 ${color}`} />
                    <span className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300">
                      {num}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
                  <p className="text-slate-400 text-sm leading-7 max-w-xs">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Pricing ── */}
        <section id="pricing" className="py-24 sm:py-32 border-t border-slate-800/60">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-slate-400 max-w-lg mx-auto">
                Start free. Upgrade only when you need more power.
                Cancel anytime.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">Free</h3>
                  <p className="mt-1 text-slate-400 text-sm">Perfect for your first few applications.</p>
                </div>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-extrabold text-white">$0</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  id="pricing-free-cta"
                  className="block w-full text-center rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>

              {/* Pro Plan */}
              <div className="relative rounded-3xl border border-violet-500/50 bg-gradient-to-b from-violet-950/60 to-slate-900/80 p-8 flex flex-col shadow-2xl shadow-violet-500/10">
                {/* Popular badge */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1 text-xs font-bold text-white shadow-lg">
                    MOST POPULAR
                  </span>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">Pro</h3>
                  <p className="mt-1 text-slate-400 text-sm">For serious job seekers applying at scale.</p>
                </div>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-extrabold text-white">$9.99</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-200">
                      <CheckCircle2 className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  id="pricing-pro-cta"
                  className="block w-full text-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity"
                >
                  Start Pro — First Month Free
                </Link>
                <p className="mt-3 text-center text-xs text-slate-500">
                  No credit card required for trial
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. FAQ ── */}
        <section id="faq" className="py-24 sm:py-32 border-t border-slate-800/60">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Frequently asked questions
              </h2>
              <p className="mt-4 text-slate-400">
                Still not sure? We&apos;re happy to help.
              </p>
            </div>

            <div className="space-y-3">
              {FAQS.map((item) => (
                <FAQItem key={item.q} {...item} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <p className="text-slate-400 text-sm">
                Can&apos;t find what you&apos;re looking for?{" "}
                <a
                  href="mailto:support@skillmate.ai"
                  className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
                >
                  Contact support
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="py-20 border-t border-slate-800/60">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/50 via-slate-900/80 to-indigo-950/50 px-8 py-14 sm:py-20">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Ready to outsmart the ATS?
              </h2>
              <p className="mt-4 text-slate-400 max-w-lg mx-auto">
                Join 1,000+ job seekers using Skillmate AI to land more interviews.
                Start free — no credit card required.
              </p>
              <Link
                href="/auth/signup"
                id="final-cta"
                className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-violet-500/25 hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── 7. Footer ── */}
      <footer className="border-t border-slate-800 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2.5 font-bold text-white text-lg">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              Skillmate AI
            </div>

            {/* Links */}
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
              <Link href="/privacy" className="hover:text-slate-300 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-slate-300 transition-colors">
                Terms of Service
              </Link>
              <Link href="/auth/login" className="hover:text-slate-300 transition-colors">
                Sign In
              </Link>
              <a
                href="mailto:support@skillmate.ai"
                className="hover:text-slate-300 transition-colors"
              >
                Contact
              </a>
            </nav>

            {/* Copyright */}
            <p className="text-xs text-slate-600">
              © 2026 Skillmate AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}