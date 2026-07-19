"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { generateCoverLetter, exportPDF } from "@/lib/api";
import { toast } from "@/lib/toast";
import { PenTool, Copy, Check, User, Briefcase, FileText, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import ContextBanner from "@/components/ContextBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function CoverLetterPage() {
    const { resumeText, jobDescription, hasResume, hasJD } = useGlobalResume();
    const [hiringManager, setHiringManager] = useState("");
    const [tone, setTone] = useState("Professional");
    const [result, setResult] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    const { getToken } = useAuth();

    const handleGenerate = async () => {
        if (!hasResume || !hasJD) {
            setError("Resume and Job Description are required. Update them in the banner above.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const token = await getToken();
            const data = await generateCoverLetter({
                resume_text: resumeText,
                job_description: jobDescription,
                hiring_manager_name: hiringManager,
                tone,
            }, token);
            setResult(data.cover_letter);
        } catch (err: any) {
            if (err.response?.status === 422 && err.response?.data?.detail) {
                const details = err.response.data.detail;
                if (Array.isArray(details)) {
                    const msgs = details.map((d: any) => {
                        const field = d.loc?.[d.loc.length - 1] || "field";
                        const label = field.replace(/_/g, " ");
                        return `${label}: ${d.msg}`;
                    });
                    setError(msgs.join(". "));
                } else {
                    setError(String(details));
                }
            } else {
                setError(err.response?.data?.detail || err.message || "Failed to generate cover letter");
            }
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        toast.success("Cover letter copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    const [exporting, setExporting] = useState(false);
    const handleExportPDF = async () => {
        if (!result) return;
        setExporting(true);
        try {
            const token = await getToken();
            await exportPDF({ content: result, title: "Cover_Letter", doc_type: "cover_letter" }, token);
            toast.success("PDF downloaded successfully!");
        } catch {
            toast.error("Failed to export PDF. Try again.");
        } finally {
            setExporting(false);
        }
    };

    return (
      <ErrorBoundary>
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 pb-10">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 p-3 rounded-xl shadow-lg shadow-purple-200">
                    <PenTool className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cover Letter Writer</h1>
                    <p className="text-slate-500 text-sm">Draft potential cover letters in seconds.</p>
                </div>
            </div>

            <ContextBanner variant="compact" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Letter Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Hiring Manager</Label>
                                    <Input
                                        placeholder="e.g. Jane Doe"
                                        value={hiringManager}
                                        onChange={(e) => setHiringManager(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Tone</Label>
                                    <select
                                        className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
                                        value={tone}
                                        onChange={(e) => setTone(e.target.value)}
                                    >
                                        <option>Professional</option>
                                        <option>Creative</option>
                                        <option>Confident</option>
                                        <option>Enthusiastic</option>
                                    </select>
                                </div>
                            </div>

                            {/* Context status */}
                            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} />
                                    <span className="text-xs text-slate-500">{hasResume ? `Resume loaded (${resumeText.length.toLocaleString()} chars)` : "No resume — add in banner above"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${hasJD ? "bg-emerald-500" : "bg-red-400"}`} />
                                    <span className="text-xs text-slate-500">{hasJD ? `JD loaded (${jobDescription.length.toLocaleString()} chars)` : "No JD — add in banner above"}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        onClick={handleGenerate}
                        loading={loading}
                        disabled={loading || !hasResume || !hasJD}
                        className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200"
                    >
                        {loading ? "Drafting..." : "Generate Cover Letter"}
                    </Button>
                </div>

                {/* Preview */}
                <div className="h-[800px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-slate-700 flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Letter Preview
                        </span>
                        {result && (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={copyToClipboard} className={copied ? "text-green-600 border-green-200 bg-green-50" : ""}>
                                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                    {copied ? "Copied" : "Copy"}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                    <Download className="h-4 w-4 mr-2" />
                                    {exporting ? "Exporting..." : "PDF"}
                                </Button>
                            </div>
                        )}
                    </div>

                    <Card className="flex-1 overflow-hidden flex flex-col shadow-md border-slate-200">
                        <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                    <Loader />
                                    <p className="animate-pulse">Writing your letter...</p>
                                </div>
                            ) : result ? (
                                <div className="font-serif text-slate-800 leading-relaxed whitespace-pre-wrap text-[15px]">
                                    {result}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-100">
                                    <PenTool className="h-12 w-12 mb-4 opacity-50" />
                                    <p>Your generated letter will appear here.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
      </ErrorBoundary>
    );
}
