"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { createRecruiterJob, type CreateJobRequest } from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  FileText,
  Settings2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function PostJobPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<CreateJobRequest>({
    title: "",
    company_name: "",
    jd_text: "",
    required_skills: "",
    experience_level: "mid",
    score_threshold: 60,
    calendly_link: "",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Job title is required");
      return;
    }
    if (!form.jd_text.trim()) {
      toast.error("Job description is required");
      return;
    }

    setCreating(true);
    try {
      const token = await getToken();
      const result = await createRecruiterJob(form, token);
      toast.success(`Job "${result.title}" created successfully!`);
      router.push("/recruiter/jobs");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/recruiter/jobs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-violet-200 dark:shadow-violet-950">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Post a New Job
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                AI will score candidates against this job description
              </p>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <Card className="dark:bg-slate-800/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4.5 w-4.5 text-violet-500" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job-title">Job Title *</Label>
                <Input
                  id="job-title"
                  placeholder="e.g. Senior Backend Engineer"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g. Acme Corp"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jd-text">Job Description *</Label>
              <textarea
                id="jd-text"
                rows={8}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none"
                placeholder="Paste the full job description here. The AI will use this to score candidate resumes..."
                value={form.jd_text}
                onChange={(e) => setForm({ ...form, jd_text: e.target.value })}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tip: Include responsibilities, requirements, and nice-to-haves for better AI scoring
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Required Skills</Label>
              <Input
                id="skills"
                placeholder="e.g. Python, FastAPI, PostgreSQL, Docker"
                value={form.required_skills}
                onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Comma-separated list of skills
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Screening Settings */}
        <Card className="dark:bg-slate-800/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4.5 w-4.5 text-violet-500" />
              Screening Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-level">Experience Level</Label>
                <select
                  id="exp-level"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500"
                  value={form.experience_level}
                  onChange={(e) => setForm({ ...form, experience_level: e.target.value })}
                >
                  <option value="junior">Junior (0-2 yrs)</option>
                  <option value="mid">Mid (2-5 yrs)</option>
                  <option value="senior">Senior (5-10 yrs)</option>
                  <option value="lead">Lead (10+ yrs)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">Score Threshold (%)</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="threshold"
                    type="range"
                    min={0}
                    max={100}
                    value={form.score_threshold}
                    onChange={(e) =>
                      setForm({ ...form, score_threshold: parseInt(e.target.value) || 60 })
                    }
                    className="flex-1 accent-violet-600"
                  />
                  <span className="text-sm font-bold text-violet-600 dark:text-violet-400 w-12 text-right">
                    {form.score_threshold}%
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Candidates scoring above this are auto-shortlisted
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendly">Calendly Link</Label>
                <Input
                  id="calendly"
                  placeholder="https://calendly.com/..."
                  value={form.calendly_link}
                  onChange={(e) => setForm({ ...form, calendly_link: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/recruiter/jobs">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={handleSubmit}
            disabled={creating}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg transition-all px-8"
          >
            {creating ? "Creating..." : "Post Job & Enable AI Screening"}
          </Button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
