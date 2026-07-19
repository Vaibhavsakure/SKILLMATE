"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import {
  getRecruiterDashboard,
  type RecruiterDashboardData,
} from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Building2,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RecruiterDashboardPage() {
  const { getToken } = useAuth();
  const [dashboard, setDashboard] = useState<RecruiterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await getRecruiterDashboard(token);
      setDashboard(data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        toast.error("Recruiter access required.");
      } else {
        toast.error("Failed to load dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  // Calculate avg score across all candidates
  const avgScore =
    dashboard && dashboard.total_candidates > 0
      ? Math.round(
          dashboard.jobs.reduce(
            (sum, j) => sum + j.avg_score * j.candidate_count,
            0
          ) / dashboard.total_candidates
        )
      : 0;

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-3 rounded-xl shadow-lg shadow-violet-200 dark:shadow-violet-950">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Dashboard
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Overview of your recruitment activity
              </p>
            </div>
          </div>
          <Link href="/recruiter/jobs/new">
            <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" /> Post a Job
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-md dark:bg-slate-800/60">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {dashboard.total_jobs}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Jobs Posted</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md dark:bg-slate-800/60">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {dashboard.total_candidates}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total CVs Screened</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md dark:bg-slate-800/60">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {dashboard.shortlisted}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Shortlisted</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md dark:bg-slate-800/60">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {avgScore}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Avg Match Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Jobs */}
        <Card className="dark:bg-slate-800/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" />
              Recent Job Postings
            </CardTitle>
            <CardDescription>
              Click a job to manage its candidate pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!dashboard || dashboard.jobs.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  No jobs posted yet
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Post your first job to start screening candidates with AI
                </p>
                <Link href="/recruiter/jobs/new">
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" /> Post First Job
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Job Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 hidden md:table-cell">Company</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Applicants</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 hidden md:table-cell">Shortlisted</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 hidden lg:table-cell">Avg Score</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{job.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 md:hidden">{job.company_name || "—"}</p>
                        </td>
                        <td className="py-4 px-4 hidden md:table-cell text-slate-600 dark:text-slate-400">
                          {job.company_name || "—"}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge
                            variant={job.is_active ? "default" : "secondary"}
                            className={
                              job.is_active
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                            }
                          >
                            {job.is_active ? "Active" : "Closed"}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {job.candidate_count}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400 hidden md:table-cell">
                          {job.shortlisted}
                        </td>
                        <td className="py-4 px-4 text-center text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                          {job.avg_score > 0 ? `${job.avg_score}%` : "—"}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Link href={`/recruiter/jobs/${job.id}/candidates`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                            >
                              View <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
