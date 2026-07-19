"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Briefcase,
  Users,
  Bell,
  Menu,
  X,
  LogOut,
  Building2,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import ThemeToggle from "@/components/ThemeToggle";
import ToastProvider from "@/components/ToastProvider";

// Recruiter Navigation Links
const recruiterNavigation = [
  { name: "Dashboard", href: "/recruiter/dashboard", icon: LayoutDashboard },
  { name: "Post a Job", href: "/recruiter/jobs/new", icon: PlusCircle },
  { name: "My Jobs", href: "/recruiter/jobs", icon: Briefcase },
  { name: "Candidates", href: "/recruiter/candidates", icon: Users },
  { name: "Notifications", href: "/recruiter/notifications", icon: Bell },
];

export default function RecruiterShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Client-side Supabase for Logout
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
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
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-violet-600 dark:text-violet-400 tracking-tight">Skillmate</span>
            <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Recruiter
            </span>
          </div>
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
            <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold uppercase">
              {user.email?.[0] || "R"}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-200 truncate" title={user.email}>{user.email}</p>
              <p className="text-xs text-violet-500 dark:text-violet-400 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Recruiter Portal
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {recruiterNavigation.map((item) => {
            const isActive = item.href === "/recruiter/dashboard"
              ? pathname === "/recruiter/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive
                    ? "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 border-r-4 border-violet-600 dark:border-violet-500"
                    : "text-gray-700 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"}
                `}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-slate-500"}`} />
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
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-slate-100">Recruiter</span>
            <span className="text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full uppercase">
              Portal
            </span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50 dark:bg-slate-950 relative transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
