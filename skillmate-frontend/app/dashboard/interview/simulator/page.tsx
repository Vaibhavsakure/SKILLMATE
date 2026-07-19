"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useVoiceInterview, type InterviewPhase } from "@/lib/useVoiceInterview";
import type { VoiceInterviewConfig } from "@/lib/api";
import {
  Mic, MicOff, Play, Square, Send, RotateCcw, ArrowLeft,
  BrainCircuit, MessageSquare, Target, TrendingUp, Clock,
  CheckCircle2, AlertTriangle, Sparkles, Volume2, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

// --- Score Ring SVG ---
function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
          strokeWidth="6" className="text-slate-200 dark:text-slate-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

// --- Phase Indicator ---
function PhaseIndicator({ phase }: { phase: InterviewPhase }) {
  const config: Record<InterviewPhase, { icon: React.ReactNode; label: string; color: string; pulse: boolean }> = {
    idle: { icon: <Play className="h-4 w-4" />, label: "Ready to Start", color: "bg-slate-500", pulse: false },
    connecting: { icon: <Zap className="h-4 w-4" />, label: "Connecting...", color: "bg-yellow-500", pulse: true },
    ready: { icon: <Mic className="h-4 w-4" />, label: "Your Turn — Speak", color: "bg-emerald-500", pulse: true },
    listening: { icon: <Volume2 className="h-4 w-4" />, label: "Listening...", color: "bg-red-500", pulse: true },
    evaluating: { icon: <BrainCircuit className="h-4 w-4" />, label: "AI Thinking...", color: "bg-purple-500", pulse: true },
    speaking: { icon: <Volume2 className="h-4 w-4" />, label: "AI Speaking...", color: "bg-blue-500", pulse: true },
    report: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Complete", color: "bg-emerald-500", pulse: false },
    error: { icon: <AlertTriangle className="h-4 w-4" />, label: "Error", color: "bg-red-500", pulse: false },
  };
  const c = config[phase];
  return (
    <div className="flex items-center gap-2">
      <div className={`relative flex items-center justify-center w-8 h-8 rounded-full text-white ${c.color}`}>
        {c.pulse && <span className={`absolute inset-0 rounded-full ${c.color} animate-ping opacity-40`} />}
        <span className="relative">{c.icon}</span>
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{c.label}</span>
    </div>
  );
}

// --- Timer Display ---
function Timer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      <Clock className="h-4 w-4" />
      <span className="text-sm font-mono font-medium">{m}:{s}</span>
    </div>
  );
}

// --- Main Page ---
export default function VoiceInterviewSimulatorPage() {
  const { getToken, token: cachedToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  // Setup form state
  const [jobTitle, setJobTitle] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [useTyping, setUseTyping] = useState(false);

  // Speech recognition
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    getToken().then(setToken).catch(() => {});
  }, [getToken]);

  const interview = useVoiceInterview(token);
  const { state } = interview;

  // --- Browser Speech Recognition (free, client-side) ---
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUseTyping(true);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      interview.setTranscript(finalTranscript);
    };

    recognition.onerror = () => { setUseTyping(true); };
    recognition.start();
    recognitionRef.current = recognition;
    interview.startRecording();
  };

  const stopAndSend = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    interview.stopRecording();
    const text = state.transcript.trim();
    if (text.length >= 5) {
      interview.sendAnswer(text);
    }
  };

  const handleStart = () => {
    if (!jobTitle || !resumeText) return;
    const config: VoiceInterviewConfig = {
      job_title: jobTitle,
      resume_text: resumeText,
      difficulty,
      total_questions: 5,
    };
    interview.startInterview(config);
  };

  const isActive = !["idle", "error", "report"].includes(state.phase);

  // ====================== RENDER ======================

  // --- Report View ---
  if (state.phase === "report" && state.report) {
    const r = state.report;
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8 pb-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl shadow-lg">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Interview Report</h1>
              <p className="text-slate-500 text-sm">{Math.floor(r.duration_seconds / 60)}m {r.duration_seconds % 60}s</p>
            </div>
          </div>
          <Button onClick={interview.resetInterview} className="gap-2">
            <RotateCcw className="h-4 w-4" /> New Interview
          </Button>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Overall", score: r.overall_score },
            { label: "Communication", score: r.communication_score },
            { label: "Technical", score: r.technical_score },
            { label: "Confidence", score: r.confidence_score },
            { label: "Problem Solving", score: r.problem_solving_score },
          ].map(({ label, score }) => (
            <Card key={label} className="text-center py-4">
              <div className="relative flex justify-center">
                <ScoreRing score={score} size={90} label={label} />
              </div>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" /> Summary</CardTitle></CardHeader>
          <CardContent><p className="text-slate-700 dark:text-slate-300 leading-relaxed">{r.summary}</p></CardContent>
        </Card>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardHeader><CardTitle className="text-emerald-600 flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {r.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader><CardTitle className="text-amber-600 flex items-center gap-2"><Target className="h-5 w-5" /> Improvements</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {r.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Q&A Detail */}
        <Card>
          <CardHeader><CardTitle>Question-by-Question Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {r.answers_detail.map((a, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-600 uppercase">{a.category}</span>
                  <span className={`text-sm font-bold ${a.score >= 7 ? "text-emerald-600" : a.score >= 5 ? "text-amber-600" : "text-red-600"}`}>
                    {a.score}/10
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Q: {a.question}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">A: {a.answer}</p>
                <p className="text-xs text-slate-500 italic">💡 {a.feedback}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Setup / Active Interview View ---
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Voice Interview Simulator
            </h1>
            <p className="text-slate-500 text-sm">AI-powered mock interview with real-time voice</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isActive && <Timer seconds={state.elapsedSeconds} />}
          <PhaseIndicator phase={state.phase} />
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Setup Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interview Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Target Role</Label>
                <Input placeholder="e.g. Frontend Engineer at Google" value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)} disabled={isActive} />
              </div>
              <div>
                <Label>Your Resume / Skills</Label>
                <Textarea className="min-h-[120px] text-sm" placeholder="Paste your resume summary..."
                  value={resumeText} onChange={(e) => setResumeText(e.target.value)} disabled={isActive} />
              </div>
              <div>
                <Label>Difficulty</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <button key={d} disabled={isActive}
                      onClick={() => setDifficulty(d)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        difficulty === d
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-purple-400"
                      } ${isActive ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {!isActive ? (
                <Button onClick={handleStart} disabled={!jobTitle || !resumeText || state.phase === "connecting"}
                  className="w-full bg-purple-600 hover:bg-purple-700 gap-2 h-12 text-base">
                  <Play className="h-5 w-5" /> Start Interview
                </Button>
              ) : (
                <Button onClick={interview.endInterview} variant="destructive" className="w-full gap-2">
                  <Square className="h-4 w-4" /> End Early
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Progress */}
          {isActive && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between text-sm text-slate-500 mb-2">
                  <span>Progress</span>
                  <span>{state.questionNumber} / {state.totalQuestions}</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${(state.questionNumber / state.totalQuestions) * 100}%` }} />
                </div>
                {state.lastScore !== null && (
                  <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 mb-1">Last Answer Score</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${state.lastScore >= 7 ? "text-emerald-600" : state.lastScore >= 5 ? "text-amber-600" : "text-red-600"}`}>
                        {state.lastScore}/10
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Interview Arena */}
        <div className="lg:col-span-2 space-y-6">
          {!isActive && state.phase === "idle" && (
            <div className="h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 p-6 rounded-full mb-6">
                <Mic className="h-16 w-16 text-purple-400" />
              </div>
              <p className="font-semibold text-lg text-slate-600 dark:text-slate-400">Voice Interview Arena</p>
              <p className="text-sm mt-1">Set up your interview details and press Start</p>
              <div className="flex items-center gap-6 mt-8 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Mic className="h-3 w-3" /> Voice Input</span>
                <span className="flex items-center gap-1"><Volume2 className="h-3 w-3" /> AI Speaks Questions</span>
                <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Real-time Scoring</span>
              </div>
            </div>
          )}

          {isActive && (
            <>
              {/* Current Question */}
              <Card className="border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                      {state.currentCategory} — Q{state.questionNumber}
                    </span>
                    <span className="text-xs text-slate-400">{state.questionNumber}/{state.totalQuestions}</span>
                  </div>
                  <p className="text-lg font-medium leading-relaxed">{state.currentQuestion}</p>
                </CardContent>
              </Card>

              {/* Feedback */}
              {state.lastFeedback && (
                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">AI Feedback</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{state.lastFeedback}</p>
                  </CardContent>
                </Card>
              )}

              {/* Answer Input */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  {state.phase === "evaluating" ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                      </div>
                      <p className="text-sm text-slate-500 animate-pulse">AI is evaluating your response...</p>
                    </div>
                  ) : state.phase === "speaking" ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="w-2 bg-blue-500 rounded-full animate-pulse"
                            style={{ height: `${20 + Math.random() * 30}px`, animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <p className="text-sm text-slate-500">AI is speaking...</p>
                    </div>
                  ) : (
                    <>
                      {/* Voice / Type Toggle */}
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setUseTyping(false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!useTyping ? "bg-purple-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"}`}>
                          🎤 Voice
                        </button>
                        <button onClick={() => setUseTyping(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${useTyping ? "bg-purple-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"}`}>
                          ⌨️ Type
                        </button>
                      </div>

                      {useTyping ? (
                        <div className="space-y-3">
                          <Textarea className="min-h-[120px]" placeholder="Type your answer here..."
                            value={typedAnswer} onChange={(e) => setTypedAnswer(e.target.value)} />
                          <Button onClick={() => { interview.sendAnswer(typedAnswer); setTypedAnswer(""); }}
                            disabled={typedAnswer.trim().length < 5}
                            className="w-full bg-purple-600 hover:bg-purple-700 gap-2">
                            <Send className="h-4 w-4" /> Submit Answer
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-6 space-y-4">
                          {state.phase === "listening" ? (
                            <>
                              <button onClick={stopAndSend}
                                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-red-900/30 transition-all active:scale-95">
                                <Square className="h-8 w-8" />
                              </button>
                              <p className="text-sm text-red-500 font-medium animate-pulse">Recording... Click to stop</p>
                              {state.transcript && (
                                <div className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                  <p className="text-xs text-slate-500 mb-1">Live Transcription:</p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{state.transcript}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <button onClick={startSpeechRecognition}
                                className="w-20 h-20 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all hover:scale-105 active:scale-95">
                                <Mic className="h-8 w-8" />
                              </button>
                              <p className="text-sm text-slate-500">Click to start speaking</p>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
