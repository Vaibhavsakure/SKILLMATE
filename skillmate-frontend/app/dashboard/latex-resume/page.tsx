"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { generateLatexResume } from "@/lib/api";
import {
  FileCode2, Copy, Check, Download, Sparkles, ExternalLink,
  Upload, FileText, X, ChevronDown, ChevronUp, Code2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import ContextBanner from "@/components/ContextBanner";

export default function LatexResumePage() {
  const { resumeText, jobDescription, hasResume, hasJD, uploadResume } = useGlobalResume();
  const [file, setFile] = useState<File | null>(null);
  const [latexCode, setLatexCode] = useState("");
  const [parsedSections, setParsedSections] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [showSections, setShowSections] = useState(false);
  const { getToken } = useAuth();
  const codeRef = useRef<HTMLPreElement>(null);

  const handleFileUpload = async (selectedFile: File) => {
    setFile(selectedFile);
    try { await uploadResume(selectedFile); }
    catch (err: any) { setError(err?.response?.data?.detail || "Failed to upload file"); }
  };

  const handleGenerate = async () => {
    if (!hasResume && !file) { setError("Please upload a resume first."); return; }
    setLoading(true); setError("");
    try {
      const token = await getToken();
      const data = await generateLatexResume(
        { resume_text: resumeText, job_description: hasJD ? jobDescription : undefined },
        token,
      );
      setLatexCode(data.latex_code);
      setParsedSections(data.parsed_sections);
    } catch (err: any) { setError(err?.response?.data?.detail || err.message || "Generation failed."); }
    finally { setLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(latexCode);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const name = parsedSections?.personal_info?.name?.replace(/\s+/g, "_") || "Resume";
    const blob = new Blob([latexCode], { type: "application/x-tex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${name}_Resume.tex`; a.click(); URL.revokeObjectURL(url);
  };

  const handleOpenOverleaf = () => {
    // Overleaf supports importing via encoded URL
    const encoded = encodeURIComponent(latexCode);
    window.open(
      `https://www.overleaf.com/docs?snip_uri=data:application/x-tex;charset=utf-8,${encoded}`,
      "_blank"
    );
  };

  const sectionCount = parsedSections
    ? Object.entries(parsedSections).filter(([, v]) =>
        (Array.isArray(v) && v.length > 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0) || (typeof v === "string" && v.length > 0)
      ).length
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
          <FileCode2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            LaTeX Resume Builder
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Convert your resume into professional Overleaf-ready LaTeX format
          </p>
        </div>
        <Badge className="ml-auto bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-sm">
          ATS-Optimized
        </Badge>
      </div>

      <ContextBanner variant="full" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Panel — Controls */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* File Upload */}
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Resume</CardTitle>
              <CardDescription>Upload to update your global resume context</CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-emerald-400 transition-all group">
                  <Upload className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2 group-hover:text-emerald-500 transition-colors" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Upload PDF/DOCX</span>
                  <input type="file" className="hidden" accept=".pdf,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                </label>
              ) : (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-emerald-900 dark:text-emerald-300 text-sm">{file.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="text-emerald-400 hover:text-emerald-700">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Context Status */}
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Context Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {hasResume ? `Resume: ${resumeText.length.toLocaleString()} chars` : "No resume — upload above"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hasJD ? "bg-emerald-500" : "bg-amber-400"}`} />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {hasJD ? `JD: ${jobDescription.length.toLocaleString()} chars` : "No JD — optional for optimization"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Template Info */}
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-800/50 dark:to-emerald-950/20">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Jake&apos;s Resume Template</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Industry-standard ATS-optimized LaTeX template. Machine-readable, single-column, clean formatting. Compatible with Overleaf, TeXShop, and all LaTeX editors.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={loading || !hasResume}
            className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30 transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2"><Loader /> Generating LaTeX...</span>
            ) : (
              <span className="flex items-center gap-2"><FileCode2 className="h-5 w-5" /> Generate LaTeX Resume</span>
            )}
          </Button>
        </div>

        {/* Right Panel — Output */}
        <div className="lg:col-span-3 space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-500" /> LaTeX Output
              </h2>
              {parsedSections && (
                <Badge variant="outline" className="text-xs">{sectionCount} sections parsed</Badge>
              )}
            </div>
            {latexCode && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenOverleaf} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30">
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Open in Overleaf
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1.5" /> .tex
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className={copied ? "text-green-600 border-green-200 bg-green-50" : ""}>
                  {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            )}
          </div>

          {/* Tabs */}
          {latexCode && (
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab("code")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "code" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
              >
                <Code2 className="h-3.5 w-3.5 inline mr-1.5" />LaTeX Code
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "preview" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
              >
                <Eye className="h-3.5 w-3.5 inline mr-1.5" />Parsed Data
              </button>
            </div>
          )}

          {/* Code / Preview Panel */}
          <Card className={`overflow-hidden border-slate-200 dark:border-slate-700 shadow-md ${latexCode ? "h-[700px]" : "h-[500px]"}`}>
            <div className="h-full overflow-y-auto">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 p-8">
                  <Loader />
                  <div className="text-center">
                    <p className="animate-pulse font-medium">Parsing resume &amp; generating LaTeX...</p>
                    <p className="text-sm mt-1 text-slate-300 dark:text-slate-600">This may take 10-15 seconds</p>
                  </div>
                </div>
              ) : latexCode ? (
                activeTab === "code" ? (
                  <pre
                    ref={codeRef}
                    className="p-6 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 whitespace-pre overflow-x-auto h-full"
                    style={{ tabSize: 2 }}
                  >
                    {latexCode}
                  </pre>
                ) : (
                  <div className="p-6 space-y-4">
                    {parsedSections && Object.entries(parsedSections).map(([key, value]) => {
                      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && !value)) return null;
                      return (
                        <div key={key} className="border border-slate-100 dark:border-slate-800 rounded-lg p-4">
                          <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                            {key.replace(/_/g, " ")}
                          </h3>
                          <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-8">
                  <FileCode2 className="h-16 w-16 mb-4 opacity-50" />
                  <p className="font-sans font-medium">LaTeX code will appear here</p>
                  <p className="font-sans text-sm mt-1 text-center max-w-sm">
                    Upload your resume, click Generate, then copy the LaTeX code to Overleaf
                  </p>
                  <div className="mt-6 flex items-center gap-6 text-xs text-slate-300 dark:text-slate-600">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ATS-Optimized</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Overleaf Ready</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Jake&apos;s Template</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Overleaf Instructions */}
          {latexCode && (
            <Card className="border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
              <CardContent className="pt-5">
                <button onClick={() => setShowSections(!showSections)} className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">📋 How to use in Overleaf</span>
                  {showSections ? <ChevronUp className="h-4 w-4 text-emerald-600" /> : <ChevronDown className="h-4 w-4 text-emerald-600" />}
                </button>
                {showSections && (
                  <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-2"><span className="font-bold text-emerald-600">1.</span> Click &quot;Open in Overleaf&quot; above, OR go to overleaf.com → New Project → Blank</li>
                    <li className="flex gap-2"><span className="font-bold text-emerald-600">2.</span> Delete all default content and paste the LaTeX code</li>
                    <li className="flex gap-2"><span className="font-bold text-emerald-600">3.</span> Click &quot;Recompile&quot; to see your professional resume PDF</li>
                    <li className="flex gap-2"><span className="font-bold text-emerald-600">4.</span> Download the PDF — it&apos;s ATS-optimized and ready to submit!</li>
                  </ol>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
