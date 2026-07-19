"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("skillmate-theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("skillmate-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("skillmate-theme", "light");
    }
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={toggle}
      id="theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 group"
    >
      <div className="relative w-5 h-5 overflow-hidden">
        <Sun
          className={`absolute inset-0 h-5 w-5 text-amber-500 transition-all duration-300 ${
            dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
        <Moon
          className={`absolute inset-0 h-5 w-5 text-indigo-400 transition-all duration-300 ${
            dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>
    </button>
  );
}
