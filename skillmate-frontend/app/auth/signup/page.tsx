"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { setUserRole } from "@/lib/api";

export default function SignupPage() {
  // Role selection
  const [selectedRole, setSelectedRole] = useState<"student" | "recruiter" | null>(null);

  // Form state
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const supabase = getSupabaseBrowserClient();

  const validateForm = () => {
    if (!selectedRole) {
      setError("Please select your role first");
      return false;
    }

    if (signupMethod === "email") {
      if (!email || !password || !confirmPassword) {
        setError("Please fill in all fields");
        return false;
      }
    } else {
      if (!phone || !password || !confirmPassword) {
        setError("Please fill in all fields");
        return false;
      }
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (signupMethod === "email") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              role: selectedRole,
            },
          },
        });

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        // Save role to backend DB
        if (data?.session?.access_token) {
          try {
            await setUserRole(selectedRole!, data.session.access_token);
          } catch (e) {
            console.warn("Role save to backend deferred:", e);
          }
        }
      } else {
        // Phone signup
        const { data, error } = await supabase.auth.signUp({
          phone,
          password,
          options: {
            channel: "sms",
            data: {
              role: selectedRole,
            },
          },
        });

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        // Save role to backend DB
        if (data?.session?.access_token) {
          try {
            await setUserRole(selectedRole!, data.session.access_token);
          } catch (e) {
            console.warn("Role save to backend deferred:", e);
          }
        }
      }

      // Role-based redirect
      if (selectedRole === "recruiter") {
        router.push("/recruiter/dashboard");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Signup failed");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!selectedRole) {
      setError("Please select your role first");
      return;
    }
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          // Pass role in metadata
          data: JSON.stringify({ role: selectedRole }),
        },
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  const handleGitHub = async () => {
    if (!selectedRole) {
      setError("Please select your role first");
      return;
    }
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          data: JSON.stringify({ role: selectedRole }),
        },
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSignup();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 py-8">
      <div className="w-full max-w-lg p-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-slate-100">
          Create Your SkillMate Account
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-6">
          Choose your role to get started
        </p>

        {/* ===== ROLE SELECTION CARDS ===== */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Student Card */}
          <button
            type="button"
            onClick={() => { setSelectedRole("student"); setError(""); }}
            className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer group
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
            <div className={`text-4xl transition-transform duration-300 ${selectedRole === "student" ? "scale-110" : "group-hover:scale-105"}`}>
              🎓
            </div>
            <div className="text-center">
              <p className={`font-semibold text-sm ${selectedRole === "student" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-slate-200"}`}>
                Student / Job Seeker
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Build resume, scan ATS, find jobs
              </p>
            </div>
          </button>

          {/* Recruiter Card */}
          <button
            type="button"
            onClick={() => { setSelectedRole("recruiter"); setError(""); }}
            className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer group
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
            <div className={`text-4xl transition-transform duration-300 ${selectedRole === "recruiter" ? "scale-110" : "group-hover:scale-105"}`}>
              💼
            </div>
            <div className="text-center">
              <p className={`font-semibold text-sm ${selectedRole === "recruiter" ? "text-violet-700 dark:text-violet-300" : "text-gray-900 dark:text-slate-200"}`}>
                Recruiter / HR
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Post jobs, screen CVs with AI
              </p>
            </div>
          </button>
        </div>

        {/* ===== SIGNUP FORM (only shown after role selection) ===== */}
        <div className={`transition-all duration-300 ${selectedRole ? "opacity-100 max-h-[1000px]" : "opacity-40 max-h-[1000px] pointer-events-none"}`}>
          {/* Toggle between Email and Phone */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSignupMethod("email")}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
                signupMethod === "email"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              Email
            </button>
            <button
              onClick={() => setSignupMethod("phone")}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
                signupMethod === "phone"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              Phone
            </button>
          </div>

          <div className="space-y-3">
            {signupMethod === "email" ? (
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-slate-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            ) : (
              <input
                type="tel"
                placeholder="Phone Number (e.g., +1234567890)"
                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-slate-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            )}

            <input
              type="password"
              placeholder="Password (min. 6 characters)"
              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />

            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-slate-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSignup}
            disabled={
              loading ||
              !selectedRole ||
              (signupMethod === "email"
                ? !email || !password || !confirmPassword
                : !phone || !password || !confirmPassword)
            }
            className={`w-full mt-5 p-3 rounded-lg font-medium transition-all text-white disabled:cursor-not-allowed ${
              selectedRole === "recruiter"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg hover:shadow-violet-200 dark:hover:shadow-violet-950 disabled:from-violet-400 disabled:to-purple-400"
                : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-950 disabled:from-indigo-400 disabled:to-blue-400"
            }`}
          >
            {loading
              ? "Creating account..."
              : selectedRole === "recruiter"
              ? "Create Recruiter Account"
              : "Create Student Account"}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading || !selectedRole}
              className="w-full border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed p-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-slate-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              onClick={handleGitHub}
              disabled={loading || !selectedRole}
              className="w-full border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed p-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-slate-300"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Continue with GitHub</span>
            </button>
          </div>

          <p className="text-sm mt-6 text-center text-gray-600 dark:text-slate-400">
            Already have an account?{" "}
            <a href="/auth/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}