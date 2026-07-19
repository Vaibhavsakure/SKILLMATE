"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import {
  getJobBoard,
  applyToJob,
  getMyApplications,
  type JobBoardItem,
  type MyApplication,
} from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  Search,
  Briefcase,
  MapPin,
  Clock,
  CheckCircle2,
  Send,
  Star,
  Building2,
  Filter,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
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
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ContextBanner from "@/components/ContextBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const EXP_LABELS: Record<string, string> = {
  junior: "Junior (0-2 yrs)",
  mid: "Mid (2-5 yrs)",
  senior: "Senior (5-10 yrs)",
  lead: "Lead (10+ yrs)",
};

export default function JobBoardPage() {
  const { getToken } = useAuth();
  const { hasResume } = useGlobalResume();

  const [jobs, setJobs] = useState<JobBoardItem[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expFilter, setExpFilter] = useState("");
  const [applying, setApplying] = useState<string | null>(null);

  // Set of job IDs the user has already applied to
  const appliedJobIds = new Set(applications.map((a) => a.job_id));

  const loadData = useCallback(async () => {
    try {
      const [jobsData, token] = await Promise.all([
        getJobBoard(search || undefined, expFilter || undefined),
        getToken(),
      ]);
      setJobs(jobsData);

      // Load user's applications
      try {
        const apps = await getMyApplications(token);
        setApplications(apps);
      } catch {
        // Silently fail — user might not have applied to anything
      }
    } catch (err: any) {
      toast.error("Failed to load job board");
    } finally {
      setLoading(false);
    }
  }, [getToken, search, expFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadData]);

  const handleApply = async (jobId: string) => {
    if (!hasResume) {
      toast.error(
        "Please upload your resume first using the context banner above.",
      );
      return;
    }
    setApplying(jobId);
    try {
      const token = await getToken();
      const result = await applyToJob(jobId, token);
      toast.success(result.message);
      // Refresh applications
      const apps = await getMyApplications(token);
      setApplications(apps);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === "You have already applied to this job") {
        toast.error("You've already applied to this job!");
      } else {
        toast.error(detail || "Application failed. Please try again.");
      }
    } finally {
      setApplying(null);
    }
  };

  const getMatchApp = (jobId: string): MyApplication | undefined =>
    applications.find((a) => a.job_id === jobId);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800";
    return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800";
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-950">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Job Board
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Browse open positions and apply with one click
            </p>
          </div>
        </div>

        {/* Context Banner */}
        <ContextBanner variant="compact" />

        {!hasResume && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Upload your resume using the banner above to see match scores and
              apply with one click.
            </AlertDescription>
          </Alert>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by title or company..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader />
          </div>
        )}

        {/* Job Cards Grid */}
        {!loading && jobs.length === 0 && (
          <div className="text-center py-20">
            <Briefcase className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
              No open positions found
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {search || expFilter
                ? "Try adjusting your search or filters"
                : "Check back later for new openings"}
            </p>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.map((job) => {
              const app = getMatchApp(job.id);
              const isApplied = appliedJobIds.has(job.id);
              const skills = job.required_skills
                ? job.required_skills.split(",").map((s) => s.trim()).filter(Boolean)
                : [];

              return (
                <Card
                  key={job.id}
                  className="group border-none shadow-md hover:shadow-xl dark:bg-slate-800/60 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
                >
                  {/* Top accent */}
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base text-slate-900 dark:text-slate-100 line-clamp-2">
                          {job.title}
                        </CardTitle>
                        {job.company_name && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {job.company_name}
                          </CardDescription>
                        )}
                      </div>

                      {/* Match Score Badge */}
                      {isApplied && app && (
                        <div
                          className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg border ${getScoreColor(
                            app.overall_score,
                          )}`}
                        >
                          <span className="text-lg font-black leading-none">
                            {app.overall_score}%
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            Match
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Meta */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                      {job.experience_level && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          {EXP_LABELS[job.experience_level] ||
                            job.experience_level}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(job.created_at)}
                      </span>
                    </div>

                    {/* JD Preview */}
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {job.jd_preview}
                    </p>

                    {/* Skills */}
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {skills.slice(0, 5).map((skill, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {skills.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{skills.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Apply Button */}
                    <div className="pt-2">
                      {isApplied ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Applied
                          </span>
                          {app && (
                            <Badge
                              className={
                                app.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 ml-auto"
                                  : app.status === "rejected"
                                  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 ml-auto"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 ml-auto"
                              }
                            >
                              {app.status === "approved"
                                ? "🎉 Shortlisted"
                                : app.status === "rejected"
                                ? "Not selected"
                                : "Under review"}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleApply(job.id)}
                          disabled={applying === job.id || !hasResume}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg transition-all"
                        >
                          {applying === job.id ? (
                            "Applying..."
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Apply Now
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* My Applications Section */}
        {applications.length > 0 && (
          <Card className="dark:bg-slate-800/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                My Applications ({applications.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                        {app.job_title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {app.company_name || "—"} ·{" "}
                        {formatDate(app.applied_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-sm font-bold ${
                          app.overall_score >= 80
                            ? "text-emerald-600 dark:text-emerald-400"
                            : app.overall_score >= 60
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {app.overall_score}%
                      </span>
                      <Badge
                        className={
                          app.status === "approved"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : app.status === "rejected"
                            ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }
                      >
                        {app.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
