"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const consent = localStorage.getItem("skillmate-cookie-consent");
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("skillmate-cookie-consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("skillmate-cookie-consent", "essential-only");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="mx-auto max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/30 p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Cookie className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              Cookie Notice
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We use essential cookies for authentication and session management.
              We do not use tracking or advertising cookies. Learn more in our{" "}
              <Link
                href="/privacy"
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Privacy Policy
              </Link>.
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={accept}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={decline}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors"
              >
                Essential Only
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={decline}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Dismiss cookie notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
