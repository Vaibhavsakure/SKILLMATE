"use client";

import { useState } from "react";
import {
  FileText,
  Briefcase,
  Upload,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";
import { useGlobalResume } from "@/lib/GlobalResumeContext";

/**
 * ContextBanner — Shows the user's current resume + JD status
 * and allows inline editing / uploading.
 *
 * Drop this at the top of any feature page that needs resume + JD context.
 * Use `variant="compact"` for a single-line status or `variant="full"` for
 * an expandable panel with edit capability.
 */
export default function ContextBanner({
  variant = "compact",
  showResume = true,
  showJD = true,
  className = "",
}: {
  variant?: "compact" | "full";
  showResume?: boolean;
  showJD?: boolean;
  className?: string;
}) {
  const {
    resumeText,
    resumeFilename,
    jobDescription,
    jdTitle,
    hasResume,
    hasJD,
    resumeCharCount,
    jdCharCount,
    isLoading,
    isSaving,
    error,
    setResumeText,
    setJobDescription,
    setJdTitle,
    uploadResume,
    saveContext,
  } = useGlobalResume();

  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      await uploadResume(file);
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-400">Loading your context...</span>
      </div>
    );
  }

  // --- Compact variant: one-line status ---
  if (variant === "compact") {
    return (
      <div className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-50/80 to-violet-50/80 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-900/50 ${className}`}>
        {/* Resume status */}
        {showResume && (
          <div className="flex items-center gap-1.5">
            <FileText className={`h-3.5 w-3.5 ${hasResume ? "text-emerald-500" : "text-slate-400"}`} />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {hasResume
                ? `📄 Resume loaded (${resumeCharCount.toLocaleString()} chars)${resumeFilename ? ` — ${resumeFilename}` : ""}`
                : "📄 No resume yet"}
            </span>
          </div>
        )}

        {showResume && showJD && (
          <span className="text-slate-300 dark:text-slate-600">|</span>
        )}

        {/* JD status */}
        {showJD && (
          <div className="flex items-center gap-1.5">
            <Briefcase className={`h-3.5 w-3.5 ${hasJD ? "text-emerald-500" : "text-slate-400"}`} />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {hasJD
                ? `📋 JD: ${jdTitle || `${jdCharCount.toLocaleString()} chars`}`
                : "📋 No job description yet"}
            </span>
          </div>
        )}

        {/* Saving indicator */}
        {isSaving && (
          <div className="ml-auto flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
            <span className="text-[10px] text-indigo-400 font-medium">Saving...</span>
          </div>
        )}

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          {expanded ? "Collapse" : "Change"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Expanded editing section */}
        {expanded && (
          <div
            className="absolute left-0 right-0 top-full mt-2 z-30 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ContextEditor
              showResume={showResume}
              showJD={showJD}
              resumeText={resumeText}
              jobDescription={jobDescription}
              jdTitle={jdTitle}
              setResumeText={setResumeText}
              setJobDescription={setJobDescription}
              setJdTitle={setJdTitle}
              onFileUpload={handleFileUpload}
              uploading={uploading}
              uploadError={uploadError}
              isSaving={isSaving}
              onSave={saveContext}
              onClose={() => setExpanded(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // --- Full variant: always expanded with edit capability ---
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 dark:from-indigo-950/30 dark:to-violet-950/30 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {hasResume ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {hasResume ? "Resume loaded" : "No resume"}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <div className="flex items-center gap-1.5">
            {hasJD ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {hasJD ? (jdTitle || "JD loaded") : "No job description"}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
        >
          {expanded ? "Collapse" : "Edit Context"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div className="p-5">
          <ContextEditor
            showResume={showResume}
            showJD={showJD}
            resumeText={resumeText}
            jobDescription={jobDescription}
            jdTitle={jdTitle}
            setResumeText={setResumeText}
            setJobDescription={setJobDescription}
            setJdTitle={setJdTitle}
            onFileUpload={handleFileUpload}
            uploading={uploading}
            uploadError={uploadError}
            isSaving={isSaving}
            onSave={saveContext}
            onClose={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

// --- Internal sub-component for editing context ---
function ContextEditor({
  showResume,
  showJD,
  resumeText,
  jobDescription,
  jdTitle,
  setResumeText,
  setJobDescription,
  setJdTitle,
  onFileUpload,
  uploading,
  uploadError,
  isSaving,
  onSave,
  onClose,
}: {
  showResume: boolean;
  showJD: boolean;
  resumeText: string;
  jobDescription: string;
  jdTitle: string;
  setResumeText: (t: string) => void;
  setJobDescription: (jd: string) => void;
  setJdTitle: (t: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  uploadError: string;
  isSaving: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Resume section */}
      {showResume && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Resume Text
            </label>
            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {uploading ? "Uploading..." : "Upload File"}
              <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={onFileUpload} disabled={uploading} />
            </label>
          </div>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your resume text here or upload a file..."
            className="w-full h-32 p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
          />
          {uploadError && (
            <p className="text-xs text-red-500 mt-1">{uploadError}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            {resumeText.length.toLocaleString()} characters
          </p>
        </div>
      )}

      {/* JD section */}
      {showJD && (
        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Briefcase className="h-3.5 w-3.5" /> Job Description
          </label>
          <input
            type="text"
            value={jdTitle}
            onChange={(e) => setJdTitle(e.target.value)}
            placeholder="JD Title (e.g. Senior Frontend Dev at Google)"
            className="w-full mb-2 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
          />
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="w-full h-28 p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            {jobDescription.length.toLocaleString()} characters
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-indigo-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Auto-saving...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm disabled:opacity-50"
          >
            Save Now
          </button>
        </div>
      </div>
    </div>
  );
}
