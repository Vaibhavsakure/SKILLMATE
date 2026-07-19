"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { GlobalResumeProvider, useGlobalResume } from "@/lib/GlobalResumeContext";
import { 
  Sparkles, Copy, Check, ArrowLeft, Wand2, Briefcase, FileText,
  Settings2, AlertCircle, Download, Loader2
} from "lucide-react";
import ResumeUploader from "@/components/ResumeUploader";
import { exportPDF } from "@/lib/api";
import ContextBanner from "@/components/ContextBanner";

function RewritePageInner() {
  const router = useRouter();
  const { resumeText: globalResume, jobDescription: globalJD, hasResume, hasJD, setResumeText: setGlobalResume } = useGlobalResume();

  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState("Professional");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const API_URL = "/api/python/resume/rewrite-stream";
  const { getToken } = useAuth();

  // Pre-populate from global context
  useEffect(() => {
    if (hasResume && !resumeText) setResumeText(globalResume);
  }, [hasResume, globalResume]);
  useEffect(() => {
    if (hasJD && !jobDescription) setJobDescription(globalJD);
  }, [hasJD, globalJD]);

  const handleRewrite = async () => {
    if (!resumeText.trim()) { setError("Please paste your resume content or upload a file."); return; }
    setError(""); setIsLoading(true); setIsStreaming(true); setResult("");
    try {
      let token: string;
      try { token = await getToken(); } catch { router.push("/auth/login"); return; }
      const formData = new FormData();
      formData.append("resume_text", resumeText);
      formData.append("job_description", jobDescription);
      formData.append("tone", tone);
      if (instructions) formData.append("custom_instructions", instructions);
      const response = await fetch(API_URL, { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData });
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.detail || "Failed to rewrite resume"); }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Streaming not supported");
      let fullText = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; const chunk = decoder.decode(value, { stream: true }); fullText += chunk; setResult(fullText); }
      setIsStreaming(false);
    } catch (err: any) { console.error(err); setError(err.message || "Something went wrong."); setIsStreaming(false); }
    finally { setIsLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleExportPDF = async () => {
    if (!result) return; setIsExporting(true);
    try { const token = await getToken(); await exportPDF({ content: result, title: "Resume_Rewrite", doc_type: "resume" }, token); }
    catch (err) { console.error("PDF export failed:", err); }
    finally { setIsExporting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"><ArrowLeft className="h-5 w-5 mr-2" /> Back to Dashboard</button>
          <div className="flex items-center gap-2"><span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">STREAMING</span><span className="text-sm font-medium text-gray-500">Uses 1 Credit</span></div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Sparkles className="h-8 w-8 text-indigo-600" /> AI Resume Rewriter</h1>
          <p className="text-gray-600 mt-2 max-w-2xl">Upload your resume or paste the text, along with the target job description. AI will stream the optimized version in real-time.</p>
        </div>

        {/* Global Context Banner */}
        <ContextBanner variant="compact" className="mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold"><FileText className="h-5 w-5 text-indigo-500" /><h3>Upload Resume</h3></div>
              <ResumeUploader onTextExtracted={(text) => { setResumeText(text); setGlobalResume(text); }} />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-900 font-semibold"><FileText className="h-5 w-5 text-indigo-500" /><h3>Resume Text</h3></div>
                {resumeText && <span className="text-xs text-gray-400">{resumeText.length} chars</span>}
              </div>
              <textarea className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed" placeholder="Or paste your resume content here..." value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold"><Briefcase className="h-5 w-5 text-indigo-500" /><h3>Target Job Description</h3></div>
              <textarea className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed" placeholder="Paste the job requirements here for keyword optimization..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold"><Settings2 className="h-5 w-5 text-indigo-500" /><h3>Refinement Settings</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tone of Voice</label><select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"><option value="Professional">Professional (Standard)</option><option value="Executive">Executive (Leadership)</option><option value="Confident">Confident (Action-Oriented)</option><option value="Creative">Creative (Unique)</option><option value="Technical">Technical (Detail-Focused)</option></select></div>
                <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Focus Area (Optional)</label><input type="text" placeholder="e.g. 'Emphasize leadership'" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" /></div>
              </div>
            </div>
            <button onClick={handleRewrite} disabled={isLoading || !resumeText} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${isLoading ? "bg-indigo-400 cursor-not-allowed" : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200"}`}>
              {isLoading ? (<><Wand2 className="h-5 w-5 animate-spin" />{isStreaming ? "Streaming Response..." : "Optimizing Resume..."}</>) : (<><Wand2 className="h-5 w-5" />Generate Optimized Resume</>)}
            </button>
            {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3"><AlertCircle className="h-5 w-5 flex-shrink-0" /><p className="text-sm">{error}</p></div>}
          </div>
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" /> AI Output{isStreaming && <span className="ml-2 inline-flex items-center gap-1 text-xs text-indigo-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />Streaming...</span>}</h3>
                {result && !isStreaming && (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600 transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">{copied ? <><Check className="h-3.5 w-3.5 text-green-500" />Copied!</> : <><Copy className="h-3.5 w-3.5" />Copy</>}</button>
                    <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50">{isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}PDF</button>
                  </div>
                )}
              </div>
              <div className="flex-1 p-8 bg-white overflow-y-auto max-h-[800px]">
                {result ? (
                  <div className="prose prose-indigo max-w-none text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">{result}{isStreaming && <span className="inline-block w-0.5 h-4 bg-indigo-600 animate-pulse ml-0.5" />}</div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20"><div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Wand2 className="h-8 w-8 text-gray-300" /></div><p className="text-center max-w-xs">Your optimized resume will stream here in real-time after generation.</p></div>
                )}
              </div>
              {result && !isStreaming && <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between"><span>AI generated content can be inaccurate.</span><span>Model: Claude Haiku</span></div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Wrap with GlobalResumeProvider since /rewrite is outside the dashboard layout
export default function RewritePage() {
  return (
    <GlobalResumeProvider>
      <RewritePageInner />
    </GlobalResumeProvider>
  );
}