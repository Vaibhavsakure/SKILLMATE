"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, CheckCircle2 } from "lucide-react";

interface ResumeUploaderProps {
  onTextExtracted: (text: string) => void;
  className?: string;
}

export default function ResumeUploader({ onTextExtracted, className = "" }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];
  const MAX_SIZE_MB = 5;

  const processFile = useCallback(async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported format (${ext}). Use PDF, DOCX, or TXT.`);
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_SIZE_MB}MB.`);
      return;
    }

    setError("");
    setIsProcessing(true);
    setFileName(file.name);

    try {
      // For TXT files, read directly
      if (ext === ".txt") {
        const text = await file.text();
        onTextExtracted(text);
        setIsProcessing(false);
        return;
      }

      // For PDF/DOCX, send to the dedicated parse endpoint
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      // Use getUser() for secure validation, then get session for token
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in to upload files.");
        setIsProcessing(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Please sign in to upload files.");
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append("resume_file", file);

      const response = await fetch("/api/python/resume/parse", {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to parse file");
      }

      const data = await response.json();
      onTextExtracted(data.text || "");
    } catch (err: any) {
      setError(err.message || "Failed to process file");
    } finally {
      setIsProcessing(false);
    }
  }, [onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const clearFile = () => {
    setFileName(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center 
          transition-all duration-200 
          ${isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01]"
            : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"
          }
          ${isProcessing ? "opacity-60 pointer-events-none" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={handleFileSelect}
        />

        {fileName ? (
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm">
              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 max-w-[200px] truncate">{fileName}</span>
              {isProcessing ? (
                <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
            {!isProcessing && (
              <button
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className={`h-8 w-8 mx-auto ${isDragging ? "text-indigo-600" : "text-gray-400 dark:text-slate-500"}`} />
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">PDF, DOCX, or TXT (max {MAX_SIZE_MB}MB)</p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
          {error}
        </p>
      )}
    </div>
  );
}
