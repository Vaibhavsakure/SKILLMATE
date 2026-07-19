"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { jobMatch } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Briefcase, CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import ContextBanner from "@/components/ContextBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function JobMatchPage() {
    const { resumeText, jobDescription, hasResume, hasJD } = useGlobalResume();
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { getToken } = useAuth();

    const handleMatch = async () => {
        if (!hasResume || !hasJD) {
            setError("Both Resume and Job Description are required. Update them in the banner above.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        try {
            const token = await getToken();
            const data = await jobMatch({ resume_text: resumeText, job_description: jobDescription }, token);
            setResult(data);
            toast.success(`Match analysis complete: ${data.match_score}% fit!`);
        } catch (err: any) {
            setError(err.message || "Match analysis failed");
            toast.error("Match analysis failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-emerald-600 bg-emerald-100 border-emerald-200";
        if (score >= 60) return "text-amber-600 bg-amber-100 border-amber-200";
        return "text-red-600 bg-red-100 border-red-200";
    };

    return (
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-10">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
                    <Briefcase className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Job Match Analyzer</h1>
                    <p className="text-slate-500 text-sm">See how well your resume fits the role using AI.</p>
                </div>
            </div>

            {/* Global Context Banner */}
            <ContextBanner variant="compact" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Context Status Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Context</CardTitle>
                            <CardDescription>
                                Your resume and job description are loaded from your global context.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {hasResume ? `Resume: ${resumeText.length.toLocaleString()} chars` : "No resume loaded — add one above"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hasJD ? "bg-emerald-500" : "bg-red-400"}`} />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {hasJD ? `Job Description: ${jobDescription.length.toLocaleString()} chars` : "No JD loaded — add one above"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        onClick={handleMatch}
                        loading={loading}
                        disabled={loading || !hasResume || !hasJD}
                        className="w-full text-lg h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg transition-all"
                    >
                        {loading ? "Analyzing..." : "Analyze Match Score"}
                    </Button>
                </div>

                <div className="space-y-6">
                    {!result && !loading && (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <Briefcase className="h-16 w-16 mb-4 opacity-50" />
                            <p className="font-medium">Analysis Results</p>
                            <p className="text-sm">Submit to see your fit</p>
                        </div>
                    )}

                    {loading && (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-4">
                            <Loader />
                            <p className="text-slate-500 animate-pulse">Comparing keywords and requirements...</p>
                        </div>
                    )}

                    {result && (
                        <>
                            {/* Score */}
                            <Card className="border-none shadow-xl shadow-indigo-100 overflow-hidden relative">
                                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                                <CardContent className="pt-10 pb-8 text-center bg-white">
                                    <div className="mb-2 text-slate-400 text-xs font-bold uppercase tracking-widest">Match Score</div>
                                    <div className={`inline-flex items-center justify-center p-8 rounded-full border-4 mb-4 ${getScoreColor(result.match_score)}`}>
                                        <span className="text-6xl font-black">{result.match_score}%</span>
                                    </div>
                                    <p className="text-slate-600 max-w-sm mx-auto text-sm">
                                        {result.match_score >= 80 ? "Great fit! You have most of the required skills." : "Some gaps found. Review the suggestions below."}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Missing Keywords */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-red-500 flex items-center gap-2">
                                        <XCircle className="h-5 w-5" /> Missing Keywords
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {result.missing_keywords?.map((kw: string, i: number) => (
                                            <Badge key={i} variant="destructive">{kw}</Badge>
                                        ))}
                                        {(!result.missing_keywords || result.missing_keywords.length === 0) && (
                                            <p className="text-slate-500 italic text-sm">No major keywords missing.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recommendation */}
                            <Card className="bg-amber-50/50 border-amber-100">
                                <CardHeader>
                                    <CardTitle className="text-amber-600 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5" /> Recommendation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-700 leading-relaxed text-sm">
                                        {result.recommendation}
                                    </p>
                                    <div className="mt-4 flex justify-end">
                                        <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-100">
                                            Apply Suggestions <ArrowRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
      </ErrorBoundary>
    );
}
