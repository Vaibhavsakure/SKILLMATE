"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";

// --- Types ---
export interface ResumeContext {
  resumeText: string;
  resumeFilename: string | null;
  jobDescription: string;
  jdTitle: string;
  hasResume: boolean;
  hasJD: boolean;
  resumeCharCount: number;
  jdCharCount: number;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setResumeText: (text: string) => void;
  setJobDescription: (jd: string) => void;
  setJdTitle: (title: string) => void;
  saveContext: () => Promise<void>;
  uploadResume: (file: File) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const GlobalResumeContext = createContext<ResumeContext | null>(null);

// --- Hook ---
export function useGlobalResume(): ResumeContext {
  const ctx = useContext(GlobalResumeContext);
  if (!ctx) {
    throw new Error("useGlobalResume must be used within <GlobalResumeProvider>");
  }
  return ctx;
}

// --- Provider ---
export function GlobalResumeProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  // State
  const [resumeText, setResumeTextState] = useState("");
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [jobDescription, setJobDescriptionState] = useState("");
  const [jdTitle, setJdTitleState] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  // Refs to track latest values (avoids stale closures)
  const resumeTextRef = useRef(resumeText);
  const jobDescriptionRef = useRef(jobDescription);
  const jdTitleRef = useRef(jdTitle);
  resumeTextRef.current = resumeText;
  jobDescriptionRef.current = jobDescription;
  jdTitleRef.current = jdTitle;

  // --- Load context on mount ---
  const fetchContext = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        // User not logged in — nothing to fetch
        setIsLoading(false);
        return;
      }
      const resp = await api.get("/context/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = resp.data;
      setResumeTextState(data.resume_text || "");
      setResumeFilename(data.resume_filename || null);
      setJobDescriptionState(data.job_description || "");
      setJdTitleState(data.jd_title || "");
    } catch (err: any) {
      // Silently fail on 401 (user not logged in yet)
      if (err?.response?.status !== 401) {
        console.error("Failed to load global context:", err);
        setError("Failed to load your resume context");
      }
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // --- Save context (debounced auto-save) ---
  const doSave = useCallback(
    async (resume: string, jd: string, title: string) => {
      try {
        setIsSaving(true);
        const token = await getToken();
        const resp = await api.post(
          "/context/save",
          {
            resume_text: resume,
            job_description: jd,
            jd_title: title,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = resp.data;
        setResumeFilename(data.resume_filename || null);
      } catch (err: any) {
        console.error("Auto-save context failed:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [getToken]
  );

  // Schedule debounced save — always reads latest values from refs
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingRef.current = true;
    saveTimerRef.current = setTimeout(() => {
      pendingRef.current = false;
      doSave(resumeTextRef.current, jobDescriptionRef.current, jdTitleRef.current);
    }, 1500); // 1.5s debounce
  }, [doSave]);

  // --- Setters with auto-save ---
  const setResumeText = useCallback(
    (text: string) => {
      setResumeTextState(text);
      scheduleSave();
    },
    [scheduleSave]
  );

  const setJobDescription = useCallback(
    (jd: string) => {
      setJobDescriptionState(jd);
      scheduleSave();
    },
    [scheduleSave]
  );

  const setJdTitle = useCallback(
    (title: string) => {
      setJdTitleState(title);
      scheduleSave();
    },
    [scheduleSave]
  );

  // --- Manual save (for explicit save button) ---
  const saveContext = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingRef.current = false;
    await doSave(resumeText, jobDescription, jdTitle);
  }, [doSave, resumeText, jobDescription, jdTitle]);

  // --- File upload ---
  const uploadResume = useCallback(
    async (file: File) => {
      try {
        setIsSaving(true);
        setError(null);
        const token = await getToken();
        const formData = new FormData();
        formData.append("resume_file", file);
        const resp = await api.post("/context/upload-resume", formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = resp.data;
        setResumeTextState(data.resume_text || "");
        setResumeFilename(data.resume_filename || null);
      } catch (err: any) {
        console.error("Resume upload failed:", err);
        setError(err?.response?.data?.detail || "Failed to upload resume");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [getToken]
  );

  // --- Computed values ---
  const hasResume = Boolean(resumeText && resumeText.length > 10);
  const hasJD = Boolean(jobDescription && jobDescription.length > 10);

  const value: ResumeContext = {
    resumeText,
    resumeFilename,
    jobDescription,
    jdTitle,
    hasResume,
    hasJD,
    resumeCharCount: resumeText.length,
    jdCharCount: jobDescription.length,
    isLoading,
    isSaving,
    error,
    setResumeText,
    setJobDescription,
    setJdTitle,
    saveContext,
    uploadResume,
    refreshContext: fetchContext,
  };

  return (
    <GlobalResumeContext.Provider value={value}>
      {children}
    </GlobalResumeContext.Provider>
  );
}
