"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ScanSearch,
  Briefcase,
  GraduationCap,
  UserCircle,
  Menu,
  X,
  LogOut,
  CreditCard,
  PenTool,
  Share2,
  FolderGit2,
  Map as MapIcon,
  History,
  Crown,
  Mic,
  Eye,
  Trophy,
  Diamond,
  FileCode2,
  Search,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import ChatWidget from "@/components/ChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
import ToastProvider from "@/components/ToastProvider";
import { GlobalResumeProvider } from "@/lib/GlobalResumeContext";

// Navigation Links Configuration (Student / Job Seeker only)
const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Resume Builder", href: "/dashboard/resumes", icon: FileText },
  { name: "LaTeX Resume", href: "/dashboard/latex-resume", icon: FileCode2 },
  { name: "Bullet Enhancer", href: "/dashboard/enhance", icon: Diamond },
  { name: "ATS Scanner", href: "/dashboard/ats", icon: ScanSearch },
  { name: "X-Ray ATS", href: "/dashboard/ats/xray", icon: Eye },
  { name: "Job Match", href: "/dashboard/jobs", icon: Briefcase },
  { name: "Job Board", href: "/dashboard/jobs/board", icon: Search },
  { name: "Interview Prep", href: "/dashboard/interview", icon: GraduationCap },
  { name: "Voice Interview", href: "/dashboard/interview/simulator", icon: Mic },
  { name: "Cover Letter", href: "/dashboard/cover-letter", icon: PenTool },
  { name: "LinkedIn Opt.", href: "/dashboard/linkedin", icon: Share2 },
  { name: "Career Roadmap", href: "/dashboard/roadmap", icon: MapIcon },
  { name: "Skill Tree", href: "/dashboard/skill-tree", icon: Trophy },
  { name: "Skill Projects", href: "/dashboard/projects", icon: FolderGit2 },
  { name: "History", href: "/dashboard/history", icon: History },
  { name: "My Credits", href: "/dashboard/credits", icon: CreditCard },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
];

export default function DashboardShell({
  children,
  user
}: {
  children: React.ReactNode;
  user: any;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Client-side Supabase for Logout
  const supabase = getSupabaseBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <GlobalResumeProvider>
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Toast Notifications */}
      <ToastProvider />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600/75 dark:bg-black/60 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`
        fixed inset-y-0 z-50 flex w-72 flex-col bg-white dark:bg-slate-900 shadow-lg dark:shadow-slate-950/50 border-r border-slate-100 dark:border-slate-800 transition-all duration-300 ease-in-out md:static md:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo Area */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">Skillmate AI</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button className="md:hidden p-2" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold uppercase">
              {user.email?.[0] || "U"}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-200 truncate" title={user.email}>{user.email}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500 flex items-center gap-1">
                <Crown className="h-3 w-3" /> Free Plan
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-r-4 border-indigo-600 dark:border-indigo-500"
                    : "text-gray-700 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"}
                `}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between bg-white dark:bg-slate-900 px-6 border-b border-slate-100 dark:border-slate-800 shadow-sm md:hidden">
          <span className="text-lg font-bold text-gray-900 dark:text-slate-100">Dashboard</span>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50 dark:bg-slate-950 relative transition-colors duration-200">
          {children}
          {/* Global Chat Widget */}
          <ChatWidget />
        </main>
      </div>
    </div>
    </GlobalResumeProvider>
  );
}