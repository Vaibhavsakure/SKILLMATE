"use client";

import { useToastStore, type ToastType } from "@/lib/toast";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
};

const bgColors: Record<ToastType, string> = {
  success: "bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800",
  error: "bg-white dark:bg-slate-800 border-red-200 dark:border-red-800",
  info: "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800",
  warning: "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800",
};

const progressColors: Record<ToastType, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
};

export default function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          aria-live="polite"
          className={`
            animate-toast-in rounded-xl border shadow-lg px-4 py-3 flex items-start gap-3
            ${bgColors[t.type]}
            transition-all duration-300
          `}
        >
          <div className="flex-shrink-0 mt-0.5">{icons[t.type]}</div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1 leading-relaxed">
            {t.message}
          </p>
          <button
            onClick={() => removeToast(t.id)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
            <div
              className={`h-full toast-progress-bar ${progressColors[t.type]}`}
              style={{ animationDuration: `${(t.duration || 4000) / 1000}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
