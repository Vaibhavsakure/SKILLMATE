"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { interviewPrep } from "@/lib/api";
import { GraduationCap, MessageSquare, BrainCircuit, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";

export default function InterviewPrepPage() {
    const [jobTitle, setJobTitle] = useState("");
    const [resumeText, setResumeText] = useState("");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { getToken } = useAuth();

    const handleGenerate = async () => {
        if (!jobTitle || !resumeText) {
            setError("Job Title and Resume Text are required.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const token = await getToken();
            const data = await interviewPrep({ job_title: jobTitle, resume_text: resumeText }, token);
            setResult(data);
        } catch (err: any) {
            setError(err.message || "Failed to generate questions");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-10">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl shadow-lg shadow-emerald-200">
                    <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Interview Coach</h1>
                    <p className="text-slate-500 text-sm">Practice with AI-generated questions tailored to you.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input Column */}
                <div className="lg:col-span-1 space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Role Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Target Job Title</Label>
                                <Input
                                    placeholder="e.g. Senior Backend Engineer"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Resume Context</Label>
                                <Textarea
                                    className="min-h-[150px] text-sm"
                                    placeholder="Paste your resume summary or skills..."
                                    value={resumeText}
                                    onChange={(e) => setResumeText(e.target.value)}
                                />
                            </div>

                            <Button
                                onClick={handleGenerate}
                                loading={loading}
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                            >
                                {loading ? "Generating..." : "Generate Questions"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Column */}
                <div className="lg:col-span-2 space-y-6">
                    {!result && !loading && (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <GraduationCap className="h-16 w-16 mb-4 opacity-50" />
                            <p className="font-medium">Interview Questions</p>
                            <p className="text-sm">Enter your details to generate</p>
                        </div>
                    )}

                    {loading && (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-4">
                            <Loader />
                            <p className="text-slate-500 animate-pulse">Brainstorming hard questions...</p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* Technical Questions */}
                            <Card className="border-none shadow-md">
                                <div className="bg-slate-900 text-white px-6 py-4 rounded-t-xl flex items-center gap-2">
                                    <BrainCircuit className="h-5 w-5 text-emerald-400" />
                                    <h3 className="font-bold">Technical Deep Dive</h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {result.technical_questions?.map((q: string, i: number) => (
                                        <div key={i} className="p-6 hover:bg-slate-50 transition-colors group">
                                            <div className="flex gap-4">
                                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                                                    {i + 1}
                                                </div>
                                                <p className="text-slate-800 font-medium leading-relaxed mt-1">
                                                    {q}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Behavioral Questions */}
                            <Card className="border-none shadow-md">
                                <div className="bg-slate-900 text-white px-6 py-4 rounded-t-xl flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-blue-400" />
                                    <h3 className="font-bold">Behavioral & Situational</h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {result.behavioral_questions?.map((q: string, i: number) => (
                                        <div key={i} className="p-6 hover:bg-slate-50 transition-colors">
                                            <div className="flex gap-4">
                                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                                    {i + 1}
                                                </div>
                                                <p className="text-slate-800 font-medium leading-relaxed mt-1">
                                                    {q}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
