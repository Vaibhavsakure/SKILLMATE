"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { optimizeLinkedIn, exportPDF } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Linkedin, UserCircle, Type, Sparkles, Copy, Check, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import ContextBanner from "@/components/ContextBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function LinkedInPage() {
    const { resumeText, hasResume } = useGlobalResume();
    const [targetRole, setTargetRole] = useState("");
    const [tone, setTone] = useState("Professional");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copiedField, setCopiedField] = useState("");
    const { getToken } = useAuth();

    const handleGenerate = async () => {
        if (!hasResume || !targetRole) {
            setError("Resume and Target Role are required. Add your resume in the banner above.");
            return;
        }
        setLoading(true); setError("");
        try {
            const token = await getToken();
            const data = await optimizeLinkedIn({ resume_text: resumeText, target_role: targetRole, tone }, token);
            setResult(data);
        } catch (err: any) { setError(err.message || "Optimization failed"); }
        finally { setLoading(false); }
    };

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success(`${field === "headline" ? "Headline" : "About section"} copied!`);
        setTimeout(() => setCopiedField(""), 2000);
    };

    const [exporting, setExporting] = useState(false);
    const handleExportPDF = async () => {
        if (!result) return;
        setExporting(true);
        try {
            const token = await getToken();
            const content = `## Optimized Headline\n${result.headline}\n\n## About Section\n${result.about_section}\n\n## Recommended Skills\n${result.suggested_skills?.join(", ") || "N/A"}`;
            await exportPDF({ content, title: "LinkedIn_Profile", doc_type: "report" }, token);
            toast.success("LinkedIn profile PDF downloaded!");
        } catch {
            toast.error("Failed to export PDF.");
        } finally {
            setExporting(false);
        }
    };

    return (
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-10">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-3 rounded-xl shadow-lg shadow-sky-200"><Linkedin className="h-6 w-6 text-white" /></div>
                <div><h1 className="text-2xl font-bold text-slate-900 tracking-tight">LinkedIn Optimizer</h1><p className="text-slate-500 text-sm">Stand out with an AI-crafted Headline and About section.</p></div>
            </div>
            <ContextBanner variant="compact" showJD={false} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                    <Card>
                        <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div><Label>Target Role</Label><Input placeholder="e.g. Product Manager" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} /></div>
                            <div>
                                <Label>Tone</Label>
                                <select className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600 transition-all" value={tone} onChange={(e) => setTone(e.target.value)}>
                                    <option>Professional</option><option>Viral/Storytelling</option><option>Concise</option>
                                </select>
                            </div>
                            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} />
                                    <span className="text-xs text-slate-500">{hasResume ? `Resume loaded (${resumeText.length.toLocaleString()} chars)` : "No resume — add in banner above"}</span>
                                </div>
                            </div>
                            <Button onClick={handleGenerate} loading={loading} disabled={loading || !hasResume || !targetRole} className="w-full bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-200">{loading ? "Optimizing..." : "Optimize Profile"}</Button>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-6">
                    {!result && !loading && (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <Linkedin className="h-16 w-16 mb-4 opacity-50" /><p className="font-medium">Profile Suggestions</p><p className="text-sm">Generate your professional brand instantly.</p>
                        </div>
                    )}
                    {loading && <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-4"><Loader /><p className="text-slate-500 animate-pulse">Crafting your personal brand...</p></div>}
                    {result && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Card className="border-none shadow-md overflow-hidden">
                                <div className="bg-slate-50 px-6 py-4 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-bold text-slate-800"><Type className="text-sky-600 h-5 w-5" /> Optimized Headline</div>
                                    <Button variant="ghost" size="sm" onClick={() => handleCopy(result.headline, "headline")} className="text-xs uppercase font-bold tracking-wider text-sky-600 hover:bg-sky-50">{copiedField === "headline" ? "Copied!" : "Copy"}</Button>
                                </div>
                                <CardContent className="p-6"><p className="text-lg font-medium text-slate-900">{result.headline}</p></CardContent>
                            </Card>
                            <Card className="border-none shadow-md overflow-hidden">
                                <div className="bg-slate-50 px-6 py-4 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-bold text-slate-800"><UserCircle className="text-sky-600 h-5 w-5" /> About Section</div>
                                    <Button variant="ghost" size="sm" onClick={() => handleCopy(result.about_section, "about")} className="text-xs uppercase font-bold tracking-wider text-sky-600 hover:bg-sky-50">{copiedField === "about" ? "Copied!" : "Copy"}</Button>
                                </div>
                                <CardContent className="p-6"><p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{result.about_section}</p></CardContent>
                            </Card>
                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Recommended Skills</h4>
                                <div className="flex flex-wrap gap-2">{result.suggested_skills?.map((skill: string, i: number) => <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-100">{skill}</Badge>)}</div>
                            </div>
                            {result && (
                                <div className="flex justify-end">
                                    <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="text-sky-600 border-sky-200 hover:bg-sky-50">
                                        <Download className="h-4 w-4 mr-2" />
                                        {exporting ? "Exporting..." : "Export PDF"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </ErrorBoundary>
    );
}
