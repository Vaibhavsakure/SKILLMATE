"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { getProjectRecommendations } from "@/lib/api";
import { FolderGit2, Code2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import ContextBanner from "@/components/ContextBanner";

export default function ProjectRecommendationsPage() {
    const { resumeText, jobDescription, hasResume, hasJD } = useGlobalResume();
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { getToken } = useAuth();

    const handleGenerate = async () => {
        if (!hasResume || !hasJD) { setError("Resume and Job Description are required. Update them in the banner above."); return; }
        setLoading(true); setError("");
        try {
            const token = await getToken();
            const data = await getProjectRecommendations({ resume_text: resumeText, job_description: jobDescription }, token);
            setResult(data);
        } catch (err: any) { setError(err.message || "Failed to generate recommendations"); }
        finally { setLoading(false); }
    };

    const getDifficultyColor = (diff: string) => {
        switch (diff.toLowerCase()) {
            case "beginner": return "bg-green-100 text-green-700 border-green-200";
            case "intermediate": return "bg-blue-100 text-blue-700 border-blue-200";
            case "advanced": return "bg-orange-100 text-orange-700 border-orange-200";
            default: return "bg-slate-100 text-slate-700";
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-10">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-3 rounded-xl shadow-lg shadow-pink-200"><FolderGit2 className="h-6 w-6 text-white" /></div>
                <div><h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Recommendations</h1><p className="text-slate-500 text-sm">Bridge your skill gaps with portfolio-worthy projects.</p></div>
            </div>
            <ContextBanner variant="compact" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                    <Card>
                        <CardHeader><CardTitle>Context</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} /><span className="text-xs text-slate-500">{hasResume ? `Resume loaded (${resumeText.length.toLocaleString()} chars)` : "No resume — add in banner above"}</span></div>
                                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${hasJD ? "bg-emerald-500" : "bg-red-400"}`} /><span className="text-xs text-slate-500">{hasJD ? `JD loaded (${jobDescription.length.toLocaleString()} chars)` : "No JD — add in banner above"}</span></div>
                            </div>
                            <Button onClick={handleGenerate} loading={loading} disabled={loading || !hasResume || !hasJD} className="w-full bg-pink-600 hover:bg-pink-700 shadow-lg shadow-pink-200">{loading ? "Analyzing Gaps..." : "Find Projects"}</Button>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-6">
                    {!result && !loading && (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <FolderGit2 className="h-16 w-16 mb-4 opacity-50" /><p className="font-medium">Skill-Building Projects</p><p className="text-sm">Click &quot;Find Projects&quot; to get personalized ideas.</p>
                        </div>
                    )}
                    {loading && <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-4"><Loader /><p className="text-slate-500 animate-pulse">Designing projects for you...</p></div>}
                    {result && (
                        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {result.projects?.map((project: any, i: number) => (
                                <Card key={i} className="overflow-hidden border-l-4 border-l-pink-500 shadow-md hover:shadow-lg transition-all">
                                    <div className="p-6 space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div><h3 className="text-xl font-bold text-slate-900">{project.title}</h3><Badge className={`mt-2 ${getDifficultyColor(project.difficulty)}`}>{project.difficulty}</Badge></div>
                                            <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Code2 className="h-6 w-6" /></div>
                                        </div>
                                        <p className="text-slate-600 leading-relaxed">{project.description}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                            <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Tech Stack</span><div className="flex flex-wrap gap-2">{project.tech_stack?.map((tech: string, j: number) => <span key={j} className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded-md">{tech}</span>)}</div></div>
                                            <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Skills Learnt</span><div className="flex flex-wrap gap-2">{project.skills_targeted?.map((skill: string, j: number) => <span key={j} className="text-xs font-medium px-2 py-1 bg-pink-50 text-pink-700 rounded-md">{skill}</span>)}</div></div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
