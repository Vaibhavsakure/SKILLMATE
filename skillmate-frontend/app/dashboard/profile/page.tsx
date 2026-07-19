"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { getCreditBalance } from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  UserCircle, Mail, Shield, CreditCard, Calendar, FileText,
  Briefcase, CheckCircle2, Upload, Settings, LogOut, Crown,
  ChevronRight, Clock, Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ContextBanner from "@/components/ContextBanner";

export default function ProfilePage() {
  const { user: authUser, token, loading: authLoading } = useAuth();
  const { hasResume, hasJD, resumeText, jobDescription, resumeFilename } = useGlobalResume();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const fetchCredits = async () => {
      if (!token || authLoading) return;
      try {
        const data = await getCreditBalance(token);
        setCredits(data.credits);
      } catch {}
    };
    fetchCredits();
  }, [token, authLoading]);

  const email = authUser?.email || "Unknown";
  const initial = email[0]?.toUpperCase() || "U";
  const joinDate = authUser?.created_at
    ? new Date(authUser.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "N/A";
  const provider = authUser?.app_metadata?.provider || "email";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-3.5 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
          <UserCircle className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            My Profile
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Manage your account, credits, and resume context.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden border-none shadow-xl">
        <div className="h-24 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600" />
        <CardContent className="relative px-8 pb-8">
          {/* Avatar */}
          <div className="-mt-12 mb-6 flex items-end gap-5">
            <div className="h-24 w-24 rounded-2xl bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-800 shadow-lg flex items-center justify-center text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {initial}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{email}</h2>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="secondary" className="text-xs">
                  <Crown className="h-3 w-3 mr-1" /> Free Plan
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Joined {joinDate}
                </span>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Mail className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Email</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Shield className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Auth Provider</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <CreditCard className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Credits</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {credits !== null ? `${credits} remaining` : "Loading..."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resume Context Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" /> Global Resume Context
          </CardTitle>
          <CardDescription>
            Your resume and job description are used across all AI tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${hasResume ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`h-5 w-5 ${hasResume ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} />
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Resume</span>
                {hasResume && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
              </div>
              {hasResume ? (
                <div className="space-y-1">
                  {resumeFilename && <p className="text-xs text-slate-500 dark:text-slate-400">File: {resumeFilename}</p>}
                  <p className="text-xs text-slate-500 dark:text-slate-400">{resumeText.length.toLocaleString()} characters</p>
                </div>
              ) : (
                <p className="text-xs text-red-500">No resume uploaded yet. Add one above.</p>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${hasJD ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className={`h-5 w-5 ${hasJD ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} />
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Job Description</span>
                {hasJD && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
              </div>
              {hasJD ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{jobDescription.length.toLocaleString()} characters</p>
              ) : (
                <p className="text-xs text-red-500">No job description set. Add one above.</p>
              )}
            </div>
          </div>

          <ContextBanner variant="compact" className="mt-4" />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-400" /> Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { label: "Upload New Resume", icon: Upload, href: "/dashboard/resumes", color: "text-blue-500" },
            { label: "View Credit History", icon: CreditCard, href: "/dashboard/credits", color: "text-amber-500" },
            { label: "View Analysis History", icon: Clock, href: "/dashboard/history", color: "text-indigo-500" },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}