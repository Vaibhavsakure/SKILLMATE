"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { LogOut, Loader2 } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
  variant?: "sidebar" | "solid"; // 'sidebar' for the menu, 'solid' for headers/pages
}

export default function LogoutButton({ 
  className = "", 
  variant = "solid" 
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
      setIsLoading(false);
    }
  };

  // VARIANT 1: Sidebar Style (Ghost Red, Full Width)
  // Perfect for the bottom of your DashboardShell sidebar
  if (variant === "sidebar") {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className={`
          flex w-full items-center px-4 py-3 text-sm font-medium text-red-600 
          rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50
          ${className}
        `}
      >
        {isLoading ? (
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        ) : (
          <LogOut className="mr-3 h-5 w-5" />
        )}
        {isLoading ? "Signing out..." : "Sign Out"}
      </button>
    );
  }

  // VARIANT 2: Solid Style (Standard Red Button)
  // Use this for profile pages or headers
  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={`
        flex items-center justify-center gap-2 px-4 py-2 
        bg-red-600 hover:bg-red-700 text-white 
        rounded-lg font-medium transition-all shadow-sm active:scale-95
        disabled:opacity-70 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      <span>{isLoading ? "Signing out..." : "Logout"}</span>
    </button>
  );
}