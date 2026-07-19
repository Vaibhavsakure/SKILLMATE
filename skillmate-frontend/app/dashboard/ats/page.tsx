"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { scanATS, type ATSResponse } from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  ScanSearch, AlertTriangle, XCircle,
  TrendingUp
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import ContextBanner from "@/components/ContextBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function AtsPage() {
  const { resumeText, jobDescription, hasResume, hasJD } = useGlobalResume();
  const [result, setResult] = useState<ATSResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { getToken } = useAuth();

  const handleScan = async () => {
    if (!hasResume) {
      setError("Please add your resume in the context banner above.");
      return;
    }
    if (!hasJD) {
      setError("Please add a job description in the context banner above.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = await getToken();

      const formData = new FormData();
      formData.append("resume_text", resumeText);
      formData.append("job_description", jobDescription);

      const response = await scanATS(formData, token);
      setResult(response);
      toast.success(`ATS Score: ${response.score}%`);

    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please try again.");
      toast.error("ATS scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 border-emerald-200 bg-emerald-50";
    if (score >= 60) return "text-amber-600 border-amber-200 bg-amber-50";
    return "text-red-600 border-red-200 bg-red-50";
  };

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-3 rounded-xl text-white shadow-lg shadow-pink-200">
              <ScanSearch className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ATS Resume Scanner</h1>
              <p className="text-slate-500 text-sm">Check your resume compatibility perfectly.</p>
            </div>
          </div>
        </div>

        {/* Global Context Banner */}
        <ContextBanner variant="compact" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Context Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Ready to Scan</CardTitle>
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

            <Button onClick={handleScan} disabled={loading || !hasResume || !hasJD} size="lg" className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-xl shadow-pink-200/50">
              {loading ? "Analyzing..." : "Calculate ATS Match Score"}
            </Button>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {!result && !loading && (
              <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <ScanSearch className="h-16 w-16 mb-4 opacity-50" />
                <p className="font-medium">Results will appear here</p>
                <p className="text-sm">Click scan to start the analysis</p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-4">
                <Loader />
                <p className="text-slate-500 animate-pulse">AI is analyzing keywords & patterns...</p>
              </div>
            )}

            {result && (
              <>
                {/* Score Card */}
                <Card className="overflow-hidden border-none shadow-xl shadow-slate-200">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-rose-500" />
                  <CardContent className="pt-10 pb-8 text-center">
                    <div className="mb-2 text-slate-500 font-medium uppercase tracking-widest text-xs">ATS Match Score</div>
                    <div className={`text-7xl font-black mb-4 ${getScoreColor(result.score).split(' ')[0]}`}>
                      {result.score}%
                    </div>
                    <div className="flex justify-center gap-2 mb-6">
                      {result.score >= 80 && <Badge variant="success" className="px-3 py-1">Excellent Match</Badge>}
                      {result.score < 80 && result.score > 50 && <Badge variant="secondary" className="px-3 py-1 bg-amber-100 text-amber-700">Needs Improvement</Badge>}
                      {result.score <= 50 && <Badge variant="destructive" className="px-3 py-1">Poor Match</Badge>}
                    </div>
                    <p className="text-slate-600 max-w-md mx-auto">
                      {result.score >= 80 ? "Your resume is highly optimized for this role!" : "You're missing some critical keywords found in the job description."}
                    </p>
                  </CardContent>
                </Card>

                {/* Missing Keywords */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" /> Missing Keywords
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_keywords?.map((kw, i: number) => (
                        <Badge key={i} variant="destructive" className="text-sm px-3 py-1.5">
                          {kw}
                        </Badge>
                      ))}
                      {(!result.missing_keywords || result.missing_keywords.length === 0) && (
                        <p className="text-slate-500 text-sm italic">No critical keywords missing!</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Suggestions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600">
                      <TrendingUp className="h-5 w-5" /> Detailed Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {result.suggestions?.map((sug, i: number) => (
                        <li key={i} className="flex gap-3 text-slate-700 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                          <span>{sug}</span>
                        </li>
                      ))}
                    </ul>
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