"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import {
  getShortlist,
  screenCandidates,
  candidateAction,
  type ShortlistResponse,
  type CandidateData,
} from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Star,
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
  Shield,
  Flag,
  ThumbsUp,
  ThumbsDown,
  Filter,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/* ---------- Score Ring ---------- */
function MiniScoreRing({
  score,
  size = 56,
}: {
  score: number;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "#10b981"
      : score >= 60
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-slate-100 dark:text-slate-700"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

/* ---------- Candidate Card ---------- */
function CandidateCard({
  candidate,
  onAction,
  acting,
}: {
  candidate: CandidateData;
  onAction: (id: number, action: "approve" | "reject") => void;
  acting: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const recColor: Record<string, string> = {
    strong_yes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    yes: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    maybe:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    no: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    approved:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    rejected:
      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 hover:shadow-md transition-shadow">
      {/* Main Row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <MiniScoreRing score={candidate.overall_score} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {candidate.applicant_name || "Unknown Candidate"}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
            {candidate.applicant_email || candidate.cv_filename || "No email"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={recColor[candidate.recommendation] || recColor.maybe}>
            {candidate.recommendation.replace("_", " ")}
          </Badge>
          <Badge className={statusColor[candidate.status] || statusColor.pending}>
            {candidate.status}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Score Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                {candidate.overall_score}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Overall</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                {candidate.skills_match}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Skills</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <p className="text-lg font-black text-violet-600 dark:text-violet-400">
                {candidate.experience_fit}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Experience
              </p>
            </div>
          </div>

          {/* Green Flags */}
          {candidate.green_flags.length > 0 && (
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" /> Green Flags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.green_flags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {candidate.red_flags.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Flag className="h-3.5 w-3.5" /> Red Flags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.red_flags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {candidate.summary && (
            <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                AI Summary
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {candidate.summary}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {candidate.status === "pending" && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(candidate.id, "approve");
                }}
                disabled={acting === candidate.id}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {acting === candidate.id ? "Processing..." : "Approve & Email"}
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(candidate.id, "reject");
                }}
                disabled={acting === candidate.id}
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function CandidatePipelinePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const { getToken } = useAuth();

  const [data, setData] = useState<ShortlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [filterRec, setFilterRec] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadShortlist = useCallback(async () => {
    try {
      const token = await getToken();
      const result = await getShortlist(
        jobId,
        token,
        filterStatus || undefined,
        filterRec || undefined,
      );
      setData(result);
    } catch (err: any) {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [jobId, getToken, filterRec, filterStatus]);

  useEffect(() => {
    loadShortlist();
  }, [loadShortlist]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const token = await getToken();
      const result = await screenCandidates(
        jobId,
        Array.from(files),
        token,
      );
      toast.success(
        `${result.candidates_screened} CV(s) screened successfully!`,
      );
      loadShortlist();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail || "Failed to screen CVs",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAction = async (
    candidateId: number,
    action: "approve" | "reject",
  ) => {
    setActing(candidateId);
    try {
      const token = await getToken();
      const result = await candidateAction(candidateId, action, token);
      toast.success(result.message);
      loadShortlist();
    } catch (err: any) {
      toast.error("Action failed");
    } finally {
      setActing(null);
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
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/recruiter/jobs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {data?.job_title || "Job Pipeline"}
            </h1>
            {data?.company_name && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {data.company_name} · Threshold: {data.score_threshold}%
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Users className="h-4 w-4" />
            {data?.total_candidates || 0} candidates
          </div>
        </div>

        {/* Upload Section */}
        <Card className="border-2 border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10">
          <CardContent className="py-8">
            <div className="text-center">
              <Upload className="h-10 w-10 mx-auto text-violet-400 mb-3" />
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                Upload CVs for AI Screening
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Drag & drop or click to select PDF, DOCX, or TXT files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-gradient-to-r from-violet-600 to-purple-600"
              >
                {uploading ? (
                  <>
                    <Loader /> Screening CVs...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Select Files
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Filter className="h-4 w-4" /> Filter:
          </div>
          <select
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none"
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
          >
            <option value="">All Recommendations</option>
            <option value="strong_yes">Strong Yes</option>
            <option value="yes">Yes</option>
            <option value="maybe">Maybe</option>
            <option value="no">No</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Candidate Cards */}
        <div className="space-y-3">
          {!data || data.candidates.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                No candidates yet
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Upload CVs above to start screening
              </p>
            </div>
          ) : (
            data.candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                onAction={handleAction}
                acting={acting}
              />
            ))
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
