"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useGlobalResume } from "@/lib/GlobalResumeContext";
import { xrayATSAnalysis, type XRayATSResponse, type SentenceAnalysis } from "@/lib/api";
import {
  CheckCircle2, AlertTriangle, XCircle, Sparkles,
  Copy, Check, Zap, Target, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import ContextBanner from "@/components/ContextBanner";

function StrengthBadge({ strength }: { strength: string }) {
  const config = {
    strong: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
    moderate: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <AlertTriangle className="h-3 w-3" /> },
    weak: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="h-3 w-3" /> },
  }[strength] || { color: "bg-slate-100 text-slate-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.color}`}>
      {config.icon} {strength}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? "from-emerald-500 to-emerald-400" : score >= 50 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">{score}%</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function SentenceCard({ sentence, index, onAccept }: {
  sentence: SentenceAnalysis; index: number; onAccept: (original: string, suggestion: string) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const handleAccept = () => { if (sentence.suggestion) { onAccept(sentence.original, sentence.suggestion); setAccepted(true); } };
  const borderColor = sentence.strength === "strong" ? "border-l-emerald-500" : sentence.strength === "weak" ? "border-l-red-500" : "border-l-amber-500";
  return (
    <div className={`p-4 border-l-4 ${borderColor} bg-white dark:bg-slate-800/50 rounded-r-xl shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
          <StrengthBadge strength={sentence.strength} />
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize">{sentence.category}</span>
        </div>
        <span className={`text-sm font-bold ${sentence.score >= 7 ? "text-emerald-600" : sentence.score >= 5 ? "text-amber-600" : "text-red-600"}`}>{sentence.score}/10</span>
      </div>
      <p className={`text-sm leading-relaxed ${accepted ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}`}>{sentence.original}</p>
      {sentence.reason && <p className="text-xs text-slate-500 mt-1 italic">💡 {sentence.reason}</p>}
      {sentence.suggestion && !accepted && (
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="flex items-center gap-1 mb-1"><Sparkles className="h-3 w-3 text-emerald-600" /><span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">AI Suggestion</span></div>
          <p className="text-sm text-emerald-800 dark:text-emerald-300">{sentence.suggestion}</p>
          <Button onClick={handleAccept} size="sm" className="mt-2 h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"><Check className="h-3 w-3" /> Accept</Button>
        </div>
      )}
      {accepted && (
        <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Replaced: {sentence.suggestion}</p>
        </div>
      )}
    </div>
  );
}

export default function XRayATSPage() {
  const { resumeText, jobDescription, hasResume, hasJD, setResumeText } = useGlobalResume();
  const [result, setResult] = useState<XRayATSResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedCount, setAcceptedCount] = useState(0);
  const { getToken } = useAuth();

  const handleAnalyze = async () => {
    if (!hasJD || !hasResume) { setError("Both Job Description and Resume are required. Update them in the banner above."); return; }
    setLoading(true); setError(""); setAcceptedCount(0);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("job_description", jobDescription);
      formData.append("resume_text", resumeText);
      setResult(await xrayATSAnalysis(formData, token));
    } catch (err: any) { setError(err?.response?.data?.detail || err.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  const handleAcceptSuggestion = (original: string, suggestion: string) => {
    setResumeText(resumeText.replace(original, suggestion));
    setAcceptedCount((prev) => prev + 1);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl shadow-lg shadow-cyan-200 dark:shadow-cyan-900/30"><Eye className="h-6 w-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">X-Ray ATS Analyzer</h1><p className="text-slate-500 text-sm">Sentence-by-sentence analysis with AI-powered suggestions</p></div>
      </div>
      <ContextBanner variant="compact" />
      {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Context</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-400"}`} /><span className="text-sm text-slate-600 dark:text-slate-400">{hasResume ? `Resume: ${resumeText.length.toLocaleString()} chars` : "No resume — add above"}</span></div>
                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${hasJD ? "bg-emerald-500" : "bg-red-400"}`} /><span className="text-sm text-slate-600 dark:text-slate-400">{hasJD ? `JD: ${jobDescription.length.toLocaleString()} chars` : "No JD — add above"}</span></div>
              </div>
              {acceptedCount > 0 && <button onClick={() => navigator.clipboard.writeText(resumeText)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Copy className="h-3 w-3" /> Copy Updated Resume</button>}
              <Button onClick={handleAnalyze} disabled={loading || !hasJD || !hasResume} className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2">
                {loading ? <><Loader /> Analyzing...</> : <><Zap className="h-4 w-4" /> Run X-Ray Analysis</>}
              </Button>
            </CardContent>
          </Card>
          {result && (
            <Card><CardContent className="pt-6 space-y-4">
              <ScoreBar label="Overall ATS" score={result.overall_score} />
              <ScoreBar label="Keywords" score={result.keyword_score} />
              <ScoreBar label="Impact" score={result.impact_score} />
              <ScoreBar label="Clarity" score={result.clarity_score} />
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-center p-2"><p className="text-lg font-bold text-emerald-600">{result.strong_count}</p><p className="text-xs text-slate-500">Strong</p></div>
                <div className="text-center p-2"><p className="text-lg font-bold text-amber-600">{result.total_sentences - result.strong_count - result.weak_count}</p><p className="text-xs text-slate-500">Moderate</p></div>
                <div className="text-center p-2"><p className="text-lg font-bold text-red-600">{result.weak_count}</p><p className="text-xs text-slate-500">Weak</p></div>
              </div>
              {acceptedCount > 0 && <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center"><p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">✅ {acceptedCount} suggestion{acceptedCount > 1 ? "s" : ""} applied</p></div>}
            </CardContent></Card>
          )}
        </div>
        <div className="lg:col-span-2 space-y-6">
          {!result && !loading && (
            <div className="h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
              <Eye className="h-16 w-16 mb-4 opacity-50" /><p className="font-medium text-lg">X-Ray Analysis Results</p><p className="text-sm mt-1">Click &quot;Run X-Ray Analysis&quot; to begin</p>
            </div>
          )}
          {loading && <div className="h-full min-h-[500px] flex flex-col items-center justify-center space-y-4"><Loader /><p className="text-slate-500 animate-pulse">Analyzing every sentence...</p><p className="text-xs text-slate-400">This may take 15-30 seconds</p></div>}
          {result && (
            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none"><CardContent className="p-6"><div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-cyan-400" /><span className="text-xs font-semibold text-cyan-400 uppercase">AI Summary</span></div><p className="text-sm leading-relaxed text-slate-300">{result.summary}</p></CardContent></Card>
              {result.missing_keywords.length > 0 && <Card><CardContent className="p-4"><p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1"><Target className="h-3 w-3" /> Missing Keywords</p><div className="flex flex-wrap gap-1.5">{result.missing_keywords.map((kw, i) => <Badge key={i} variant="destructive" className="text-xs">{kw}</Badge>)}</div></CardContent></Card>}
              <div className="space-y-3">{result.sentences.map((s, i) => <SentenceCard key={i} sentence={s} index={i} onAccept={handleAcceptSuggestion} />)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
