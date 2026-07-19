"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getRecruiterDashboard, type RecruiterDashboardData } from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  Briefcase,
  Plus,
  ArrowRight,
  Users,
  CheckCircle2,
  Clock,
  Search,
  TrendingUp,
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

export default function MyJobsPage() {
  const { getToken } = useAuth();
  const [dashboard, setDashboard] = useState<RecruiterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadJobs = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await getRecruiterDashboard(token);
      setDashboard(data);
    } catch (err: any) {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const filteredJobs = dashboard?.jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.company_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-3 rounded-xl shadow-lg shadow-violet-200 dark:shadow-violet-950">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                My Jobs
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {dashboard?.total_jobs || 0} job{(dashboard?.total_jobs || 0) !== 1 ? "s" : ""} posted
              </p>
            </div>
          </div>
          <Link href="/recruiter/jobs/new">
            <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" /> Post New Job
            </Button>
          </Link>
        </div>

        {/* Search */}
        {dashboard && dashboard.jobs.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search jobs..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
              {searchQuery ? "No jobs match your search" : "No jobs posted yet"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {searchQuery ? "Try a different search term" : "Create your first job to start screening candidates"}
            </p>
            {!searchQuery && (
              <Link href="/recruiter/jobs/new">
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" /> Post First Job
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="group border-none shadow-md hover:shadow-xl dark:bg-slate-800/60 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
              >
                {/* Top accent */}
                <div className={`h-1 ${job.is_active ? "bg-gradient-to-r from-violet-500 to-purple-500" : "bg-slate-300 dark:bg-slate-600"} opacity-60 group-hover:opacity-100 transition-opacity`} />

                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {job.title}
                      </h3>
                      {job.company_name && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {job.company_name}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        job.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }
                    >
                      {job.is_active ? "Active" : "Closed"}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3 text-blue-500" />
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {job.candidate_count}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Applicants</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {job.shortlisted}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Shortlisted</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3 text-violet-500" />
                        <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                          {job.avg_score > 0 ? `${job.avg_score}%` : "—"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Avg Score</p>
                    </div>
                  </div>

                  {/* View Pipeline Button */}
                  <Link href={`/recruiter/jobs/${job.id}/candidates`}>
                    <Button
                      variant="outline"
                      className="w-full text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all"
                    >
                      View Candidates <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
