"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { generateRoadmap } from "@/lib/api";
import { Map as MapIcon, Flag, BookOpen, CheckCircle2, ArrowRight, Target, Clock, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface Milestone {
    step_number: number;
    title: string;
    description: string;
    resources: string[];
    estimated_weeks: string;
}

export default function RoadmapPage() {
    const [targetRole, setTargetRole] = useState("");
    const [currentSkills, setCurrentSkills] = useState("");
    const [roadmap, setRoadmap] = useState<{ role_summary: string; milestones: Milestone[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { getToken } = useAuth();

    const handleGenerate = async () => {
        if (!targetRole) return;
        setLoading(true);
        setError("");
        setRoadmap(null);

        try {
            const token = await getToken();
            if (!token) throw new Error("Please sign in to generate a roadmap");

            const data = await generateRoadmap({ target_role: targetRole, current_skills: currentSkills }, token);
            setRoadmap(data as { role_summary: string; milestones: Milestone[] });
        } catch (err: any) {
            setError(err.message || "Failed to generate roadmap. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-xl">
                    <MapIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Career Roadmap</h1>
                    <p className="text-slate-500 text-sm">Visualize your path to your dream job.</p>
                </div>
            </div>

            {/* Input Section */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="target">Target Role (Dream Job)</Label>
                            <Input
                                id="target"
                                placeholder="e.g. Senior Frontend Engineer, AI Researcher"
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="current">Current Skills (Optional)</Label>
                            <Input
                                id="current"
                                placeholder="e.g. Knows React, Basic Python..."
                                value={currentSkills}
                                onChange={(e) => setCurrentSkills(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        onClick={handleGenerate}
                        disabled={loading || !targetRole}
                        className="w-full bg-blue-600 hover:bg-blue-700 size-lg font-medium"
                    >
                        {loading ? <><span className="animate-spin mr-2">⏳</span> Planning Path...</> : "Generate My Roadmap 🚀"}
                    </Button>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader />
                    <p className="text-slate-500 mt-4 animate-pulse">Consulting career experts...</p>
                </div>
            )}

            {/* Roadmap Visualization */}
            {roadmap && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-lg text-center">
                        <h2 className="text-xl font-bold text-blue-900 mb-2">🎯 Goal: {targetRole}</h2>
                        <p className="text-blue-700 italic">"{roadmap.role_summary}"</p>
                    </div>

                    <div className="relative border-l-4 border-blue-200 ml-4 md:ml-6 space-y-8 pl-8 py-2">
                        {roadmap.milestones.map((step, index) => (
                            <div key={index} className="relative group">
                                {/* Timeline Dot */}
                                <div className="absolute -left-[45px] top-0 bg-white border-4 border-blue-500 text-blue-600 font-bold rounded-full h-10 w-10 flex items-center justify-center shadow-sm z-10 group-hover:scale-110 transition-transform">
                                    {step.step_number}
                                </div>

                                <Card className="hover:shadow-md transition-shadow border-slate-200">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg font-bold text-slate-800">{step.title}</CardTitle>
                                            <div className="flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                <Clock className="w-3 h-3 mr-1" /> {step.estimated_weeks}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-slate-600 text-sm">{step.description}</p>

                                        {step.resources.length > 0 && (
                                            <div className="bg-slate-50 p-3 rounded-md">
                                                <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center">
                                                    <BookOpen className="w-3 h-3 mr-1" /> Recommended Resources:
                                                </p>
                                                <ul className="text-sm text-blue-600 space-y-1">
                                                    {step.resources.map((res, i) => (
                                                        <li key={i} className="flex items-center hover:underline cursor-pointer">
                                                            <ArrowRight className="w-3 h-3 mr-2 text-slate-400" /> {res}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        ))}

                        {/* Final Flag */}
                        <div className="relative">
                            <div className="absolute -left-[45px] top-0 bg-green-500 text-white rounded-full h-10 w-10 flex items-center justify-center shadow-md z-10">
                                <Flag className="h-5 w-5" />
                            </div>
                            <div className="text-slate-400 text-sm py-2 italic ml-2">
                                Congratulations! You're ready to apply.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
