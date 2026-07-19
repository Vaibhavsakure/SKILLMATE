"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { rewriteResume, generateLatexResume } from "@/lib/api";
import {
  Upload, FileText, X, Wand2, Copy, Check, Sparkles, Download,
  FileCode2, ExternalLink, Code2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import ScoreComparison from "@/components/ScoreComparison";
import ContextBanner from "@/components/ContextBanner";

interface ScoreComparisonData {
  score_before: number;
  score_after: number;
  improvement: number;
  keywords_added: string[];
  keywords_before: number;
  keywords_after: number;
  section_scores_before: Record<string, number>;
  section_scores_after: Record<string, number>;
}

export default function ResumeBuilderPage() {
  const { resumeText, jobDescription, hasResume, hasJD, uploadResume } = useGlobalResume();
  const [file, setFile] = useState<File | null>(null);
  const [tone, setTone] = useState("Professional");
  const [outputFormat, setOutputFormat] = useState<"text" | "latex">("text");
  const [result, setResult] = useState("");
  const [latexCode, setLatexCode] = useState("");
  const [scoreComparison, setScoreComparison] = useState<ScoreComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { getToken } = useAuth();

  const handleFileUpload = async (selectedFile: File) => {
    setFile(selectedFile);
    try { await uploadResume(selectedFile); }
    catch (err: any) { setError(err?.response?.data?.detail || "Failed to upload file"); }
  };

  const handleGenerate = async () => {
    if (!hasResume && !file) { setError("Please upload a resume or add one in the banner above."); return; }
    setLoading(true); setError(""); setScoreComparison(null);

    try {
      const token = await getToken();

      if (outputFormat === "latex") {
        // LaTeX generation mode
        const data = await generateLatexResume(
          {
            resume_text: resumeText,
            job_description: hasJD ? jobDescription : undefined,
          },
          token,
        );
        setLatexCode(data.latex_code);
        setResult(""); // Clear plain text result
      } else {
        // Plain text rewrite mode
        if (!hasJD) { setError("Job Description is required for plain text mode. Add one in the banner above."); setLoading(false); return; }
        const formData = new FormData();
        if (file) formData.append("resume_file", file);
        else formData.append("resume_text", resumeText);
        formData.append("job_description", jobDescription);
        formData.append("tone", tone);
        const data = await rewriteResume(formData, token);
        setResult(data.rewritten_content);
        setLatexCode(""); // Clear LaTeX result
        if (data.score_comparison) setScoreComparison(data.score_comparison);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Failed to generate resume.");
    } finally { setLoading(false); }
  };

  // Current output content
  const currentOutput = outputFormat === "latex" ? latexCode : result;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentOutput);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (outputFormat === "latex") {
      const blob = new Blob([latexCode], { type: "application/x-tex" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `Resume_LaTeX_${new Date().toISOString().slice(0, 10)}.tex`;
      a.click(); URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([result], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `Resume_${tone}_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click(); URL.revokeObjectURL(url);
    }
  };

  const handleOpenOverleaf = () => {
    const encoded = encodeURIComponent(latexCode);
    window.open(
      `https://www.overleaf.com/docs?snip_uri=data:application/x-tex;charset=utf-8,${encoded}`,
      "_blank"
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30"><Wand2 className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Resume AI Rewriter</h1><p className="text-slate-500 dark:text-slate-400">Tailor your resume instantly for any job role.</p></div>
      </div>

      <ContextBanner variant="full" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

          {/* File upload — uploads to global context */}
          <Card>
            <CardHeader><CardTitle>Upload Resume File</CardTitle><CardDescription>Upload to update your global resume context.</CardDescription></CardHeader>
            <CardContent>
              {!file ? (
                <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-blue-400 transition-all group">
                  <Upload className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2 group-hover:text-blue-500 transition-colors" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Upload PDF/DOCX</span>
                  <input type="file" className="hidden" accept=".pdf,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                </label>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-4 rounded-xl">
                  <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="font-medium text-blue-900 dark:text-blue-300">{file.name}</span></div>
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="text-blue-400 hover:text-blue-700"><X className="h-4 w-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Context status */}
          <Card>
            <CardHeader><CardTitle>Context Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} /><span className="text-sm text-slate-600 dark:text-slate-400">{hasResume ? `Resume: ${resumeText.length.toLocaleString()} chars` : "No resume — upload above or add in banner"}</span></div>
              <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${hasJD ? "bg-emerald-500" : "bg-red-400"}`} /><span className="text-sm text-slate-600 dark:text-slate-400">{hasJD ? `JD: ${jobDescription.length.toLocaleString()} chars` : "No JD — add in banner above"}</span></div>
            </CardContent>
          </Card>

          {/* Output Format */}
          <Card>
            <CardHeader><CardTitle>Output Format</CardTitle><CardDescription>Choose how your resume is generated</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setOutputFormat("text")}
                  className={`py-4 px-3 rounded-xl text-sm font-medium border transition-all flex flex-col items-center gap-2 ${
                    outputFormat === "text"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900/30"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                  }`}
                >
                  <FileText className="h-5 w-5" />
                  <span>Plain Text</span>
                  <span className={`text-[10px] ${outputFormat === "text" ? "text-blue-200" : "text-slate-400"}`}>Standard rewrite</span>
                </button>
                <button
                  onClick={() => setOutputFormat("latex")}
                  className={`py-4 px-3 rounded-xl text-sm font-medium border transition-all flex flex-col items-center gap-2 relative ${
                    outputFormat === "latex"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-300"
                  }`}
                >
                  <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[9px] px-1.5 py-0.5">NEW</Badge>
                  <FileCode2 className="h-5 w-5" />
                  <span>LaTeX (Overleaf)</span>
                  <span className={`text-[10px] ${outputFormat === "latex" ? "text-emerald-200" : "text-slate-400"}`}>Professional format</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Tone — only shown for plain text mode */}
          {outputFormat === "text" && (
            <Card>
              <CardHeader><CardTitle>Select Tone</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {["Professional", "Confident", "Creative"].map((t) => (
                    <button key={t} onClick={() => setTone(t)} className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all ${tone === t ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300"}`}>{t}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* LaTeX info card */}
          {outputFormat === "latex" && (
            <Card className="border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg"><Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Jake&apos;s Resume Template</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ATS-optimized LaTeX template. Copy to Overleaf for instant professional PDF. JD is optional — resume will be parsed into structured format.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading || (!hasResume && !file) || (outputFormat === "text" && !hasJD)}
            className={`w-full h-14 text-lg hover:shadow-lg transition-all ${
              outputFormat === "latex"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-emerald-200/50"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-200/50"
            }`}
          >
            {loading
              ? (outputFormat === "latex" ? "Generating LaTeX..." : "Generating Resume...")
              : (outputFormat === "latex" ? "Generate LaTeX Resume" : "Generate Optimized Resume")
            }
          </Button>
        </div>

        <div className="space-y-6">
          {scoreComparison && outputFormat === "text" && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <ScoreComparison scoreBefore={scoreComparison.score_before} scoreAfter={scoreComparison.score_after} improvement={scoreComparison.improvement} keywordsAdded={scoreComparison.keywords_added} keywordsBefore={scoreComparison.keywords_before} keywordsAfter={scoreComparison.keywords_after} sectionScoresBefore={scoreComparison.section_scores_before} sectionScoresAfter={scoreComparison.section_scores_after} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {outputFormat === "latex"
                ? <><Code2 className="h-5 w-5 text-emerald-500" /> LaTeX Output</>
                : <><Sparkles className="h-5 w-5 text-indigo-500" /> Optimized Result</>
              }
            </h2>
            {currentOutput && (
              <div className="flex items-center gap-2">
                {outputFormat === "latex" && latexCode && (
                  <Button variant="outline" size="sm" onClick={handleOpenOverleaf} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800">
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Overleaf
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> {outputFormat === "latex" ? ".tex" : "Save"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className={copied ? "text-green-600 border-green-200 bg-green-50" : ""}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            )}
          </div>

          <Card className={`overflow-hidden flex flex-col border-slate-200 dark:border-slate-700 shadow-md ${scoreComparison && outputFormat === "text" ? "h-[560px]" : "h-[800px]"}`}>
            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800/30">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <Loader />
                  <p className="animate-pulse">
                    {outputFormat === "latex" ? "Parsing resume & generating LaTeX..." : "Rewriting your resume & computing ATS scores..."}
                  </p>
                </div>
              ) : currentOutput ? (
                outputFormat === "latex" ? (
                  <pre className="p-6 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre overflow-x-auto h-full bg-slate-50 dark:bg-slate-900/50" style={{ tabSize: 2 }}>
                    {latexCode}
                  </pre>
                ) : (
                  <div className="p-8 font-serif text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {result}
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl">
                  {outputFormat === "latex" ? <FileCode2 className="h-16 w-16 mb-4 opacity-50" /> : <FileText className="h-16 w-16 mb-4 opacity-50" />}
                  <p className="font-sans">Generated resume will appear here</p>
                  <p className="font-sans text-sm mt-1">
                    {outputFormat === "latex" ? "Professional LaTeX code ready for Overleaf" : "With before/after ATS score comparison"}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}