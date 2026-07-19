"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { setUserRole } from "@/lib/api";

export default function SelectRolePage() {
  const [selectedRole, setSelectedRole] = useState<"student" | "recruiter" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { getToken, user } = useAuth();
  const router = useRouter();

  const handleContinue = async () => {
    if (!selectedRole) {
      setError("Please select your role");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      // Save role to backend
      await setUserRole(selectedRole, token);

      // Update Supabase user metadata
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.updateUser({
        data: { role: selectedRole },
      });

      // Redirect based on role
      if (selectedRole === "recruiter") {
        router.push("/recruiter/dashboard");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to set role. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-lg p-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-slate-100">
          Welcome to SkillMate! 🎉
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-8">
          One last step — tell us how you'll use SkillMate
        </p>

        {/* Role Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            type="button"
            onClick={() => { setSelectedRole("student"); setError(""); }}
            className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer group
              ${selectedRole === "student"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-lg shadow-indigo-100 dark:shadow-indigo-950/50 scale-[1.02]"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md"
              }`}
          >
            {selectedRole === "student" && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="text-5xl">🎓</div>
            <div className="text-center">
              <p className={`font-semibold ${selectedRole === "student" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-slate-200"}`}>
                Student / Job Seeker
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Build resume, scan ATS, find jobs
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedRole("recruiter"); setError(""); }}
            className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer group
              ${selectedRole === "recruiter"
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 shadow-lg shadow-violet-100 dark:shadow-violet-950/50 scale-[1.02]"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md"
              }`}
          >
            {selectedRole === "recruiter" && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="text-5xl">💼</div>
            <div className="text-center">
              <p className={`font-semibold ${selectedRole === "recruiter" ? "text-violet-700 dark:text-violet-300" : "text-gray-900 dark:text-slate-200"}`}>
                Recruiter / HR
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Post jobs, screen CVs with AI
              </p>
            </div>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedRole || loading}
          className={`w-full p-3 rounded-lg font-medium transition-all text-white disabled:cursor-not-allowed ${
            selectedRole === "recruiter"
              ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg disabled:from-violet-400 disabled:to-purple-400"
              : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg disabled:from-indigo-400 disabled:to-blue-400"
          }`}
        >
          {loading ? "Setting up..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
