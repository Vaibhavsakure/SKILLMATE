import Link from "next/link";
import { 
  ArrowRight, 
  FileText, 
  Sparkles, 
  Target, 
  Zap, 
  CheckCircle2 
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      
      {/* 1. Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            Skillmate AI
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
            <div className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600 mb-8 border border-indigo-100">
              <Zap className="mr-2 h-4 w-4 fill-indigo-600" />
              Powered by Multi-Model AI
            </div>
            
            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-slate-900 sm:text-7xl">
              Beat the ATS. <br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Land the Interview.
              </span>
            </h1>
            
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Skillmate uses advanced AI to analyze job descriptions, rewrite your resume, and optimize your profile to pass automated screening tools instantly.
            </p>
            
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/dashboard"
                className="group flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1"
              >
                Launch Dashboard
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Feature Stats */}
            <div className="mt-16 grid grid-cols-2 gap-8 border-y border-slate-200 py-8 sm:grid-cols-4 bg-white/50">
              {[
                { label: "AI Models", value: "Multi-LLM" },
                { label: "Career Tools", value: "12+" },
                { label: "Time Saved", value: "~5hrs/app" },
                { label: "ATS Accuracy", value: "Real-time" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Features Grid */}
        <section className="bg-white py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Everything you need to get hired
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Stop guessing keywords. Our AI tools handle the technical optimization so you can focus on the interview.
              </p>
            </div>

            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                
                {/* Feature 1: Rewrite */}
                <div className="flex flex-col rounded-2xl bg-slate-50 p-8 transition-colors hover:bg-indigo-50/50">
                  <dt className="flex items-center gap-x-3 text-base font-bold text-slate-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    Smart Resume Rewrite
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                    <p className="flex-auto">
                      Automatically tailor your resume content to match specific job descriptions. Our AI adjusts tone, keywords, and formatting to boost relevance.
                    </p>
                  </dd>
                </div>

                {/* Feature 2: ATS Score */}
                <div className="flex flex-col rounded-2xl bg-slate-50 p-8 transition-colors hover:bg-indigo-50/50">
                  <dt className="flex items-center gap-x-3 text-base font-bold text-slate-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-600 text-white">
                      <Target className="h-6 w-6" />
                    </div>
                    ATS Compatibility Check
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                    <p className="flex-auto">
                      Get a detailed score of how well your resume parses. Identify missing sections, unreadable fonts, and keyword gaps instantly.
                    </p>
                  </dd>
                </div>

                {/* Feature 3: Job Match */}
                <div className="flex flex-col rounded-2xl bg-slate-50 p-8 transition-colors hover:bg-indigo-50/50">
                  <dt className="flex items-center gap-x-3 text-base font-bold text-slate-900">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white">
                      <FileText className="h-6 w-6" />
                    </div>
                    Cover Letter Generator
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                    <p className="flex-auto">
                      Generate personalized cover letters that weave your experience into the company's mission statement. No more generic templates.
                    </p>
                  </dd>
                </div>

              </dl>
            </div>
          </div>
        </section>

        {/* 4. Pricing / Credits Teaser */}
        <section className="bg-slate-900 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Simple, Credit-Based Pricing
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-300">
                Start for free. Pay only when you use advanced AI features.
              </p>
            </div>
            <div className="mx-auto mt-16 max-w-lg rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 sm:mt-20 lg:mx-0 lg:flex lg:max-w-none">
              <div className="p-8 sm:p-10 lg:flex-auto">
                <h3 className="text-2xl font-bold tracking-tight text-white">Free Starter Plan</h3>
                <p className="mt-6 text-base leading-7 text-slate-300">
                  Perfect for optimizing your first few applications. Get access to basic scanning and limited rewrites.
                </p>
                <div className="mt-10 flex items-center gap-x-4">
                  <h4 className="flex-none text-sm font-semibold leading-6 text-indigo-400">What&apos;s included</h4>
                  <div className="h-px flex-auto bg-slate-700" />
                </div>
                <ul className="mt-8 grid grid-cols-1 gap-4 text-sm leading-6 text-slate-300 sm:grid-cols-2">
                  {['5 Free Credits', 'Basic ATS Scan', '1 Resume Version', 'Email Support'].map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckCircle2 className="h-6 w-5 flex-none text-indigo-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="-mt-2 p-2 lg:mt-0 lg:w-full lg:max-w-md lg:flex-shrink-0">
                <div className="rounded-2xl bg-slate-900 py-10 text-center ring-1 ring-inset ring-slate-900/5 lg:flex lg:flex-col lg:justify-center lg:py-16">
                  <div className="mx-auto max-w-xs px-8">
                    <p className="text-base font-semibold text-slate-300">No credit card required</p>
                    <p className="mt-6 flex items-baseline justify-center gap-x-2">
                      <span className="text-5xl font-bold tracking-tight text-white">$0</span>
                      <span className="text-sm font-semibold leading-6 text-slate-300">/forever</span>
                    </p>
                    <Link
                      href="/auth/signup"
                      className="mt-10 block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Get Access
                    </Link>
                    <p className="mt-6 text-xs leading-5 text-slate-300">
                      Invoices and receipts available for easy company reimbursement
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 5. Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-center text-xs leading-5 text-slate-500">
            &copy; 2026 Skillmate AI, Inc. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="/privacy" className="hover:text-indigo-600">Privacy Policy</a>
            <a href="/terms" className="hover:text-indigo-600">Terms of Service</a>
            <a href="mailto:support@skillmate.ai" className="hover:text-indigo-600">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}