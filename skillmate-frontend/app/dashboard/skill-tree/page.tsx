"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { generateSkillTree, type SkillTreeResponse, type SkillNode } from "@/lib/api";
import {
  Trophy, Lock, CheckCircle2, Zap, Star, ExternalLink,
  Play, BookOpen, Video, FileText, Code, ChevronDown, ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";

// --- Status config ---
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  mastered: { color: "text-emerald-600", bg: "bg-emerald-500", icon: <CheckCircle2 className="h-4 w-4" />, label: "Mastered" },
  in_progress: { color: "text-blue-600", bg: "bg-blue-500", icon: <Zap className="h-4 w-4" />, label: "Learning" },
  recommended: { color: "text-amber-600", bg: "bg-amber-500", icon: <Star className="h-4 w-4" />, label: "Start Here" },
  locked: { color: "text-slate-400", bg: "bg-slate-400", icon: <Lock className="h-4 w-4" />, label: "Locked" },
};

const CATEGORY_COLORS: Record<string, string> = {
  foundation: "from-blue-500 to-cyan-500",
  core: "from-purple-500 to-indigo-500",
  advanced: "from-orange-500 to-red-500",
  specialist: "from-emerald-500 to-teal-500",
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="h-3 w-3" />,
  course: <BookOpen className="h-3 w-3" />,
  article: <FileText className="h-3 w-3" />,
  project: <Code className="h-3 w-3" />,
};

// --- XP Bar ---
function XPBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min((current / total) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold text-amber-600 dark:text-amber-400">{current} XP</span>
        <span className="text-slate-400">{total} XP</span>
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// --- Level Dots ---
function LevelDots({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
          i < current ? "bg-amber-500 shadow-sm shadow-amber-300" : "bg-slate-200 dark:bg-slate-700"
        }`} />
      ))}
    </div>
  );
}

// --- Skill Node Card ---
function SkillNodeCard({ node }: { node: SkillNode }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[node.status] || STATUS_CONFIG.locked;
  const catGradient = CATEGORY_COLORS[node.category] || "from-slate-500 to-slate-600";
  const isLocked = node.status === "locked";

  return (
    <div className={`rounded-xl border shadow-sm transition-all hover:shadow-md ${
      isLocked ? "opacity-60 border-slate-200 dark:border-slate-700" : "border-slate-200 dark:border-slate-700"
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${catGradient} flex items-center justify-center text-white`}>
              {status.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{node.name}</h3>
              <span className="text-xs text-slate-400 capitalize">{node.category}</span>
            </div>
          </div>
          <Badge className={`text-xs ${status.color} bg-transparent border`}>{status.label}</Badge>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{node.description}</p>

        {/* Level & XP */}
        <div className="flex items-center justify-between mb-2">
          <LevelDots current={node.current_level} max={node.max_level} />
          <span className="text-xs font-semibold text-amber-600">+{node.xp_reward} XP</span>
        </div>

        {/* Expand Toggle */}
        {node.resources.length > 0 && !isLocked && (
          <button onClick={() => setExpanded(!expanded)}
            className="w-full mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} Resources ({node.resources.length})
          </button>
        )}
      </div>

      {/* Resources */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2 bg-slate-50 dark:bg-slate-800/30 rounded-b-xl">
          {node.resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors group">
              <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                {RESOURCE_ICONS[r.type] || <BookOpen className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-blue-600">{r.title}</p>
                <p className="text-[10px] text-slate-400">{r.platform} · {r.duration}</p>
              </div>
              <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-blue-500" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


// --- Main Page ---
export default function SkillTreePage() {
  const [targetRole, setTargetRole] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [result, setResult] = useState<SkillTreeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { getToken } = useAuth();

  const handleGenerate = async () => {
    if (!targetRole || !currentSkills) { setError("Both fields required."); return; }
    setLoading(true); setError("");
    try {
      const token = await getToken();
      const data = await generateSkillTree({ target_role: targetRole, current_skills: currentSkills, experience_level: level }, token);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Failed");
    } finally { setLoading(false); }
  };

  const categories = ["foundation", "core", "advanced", "specialist"];
  const categoryLabels: Record<string, string> = {
    foundation: "🏗️ Foundation", core: "⚡ Core Skills", advanced: "🚀 Advanced", specialist: "👑 Specialist"
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-xl shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Career Skill Tree</h1>
          <p className="text-slate-500 text-sm">Gamified learning path to your dream role</p>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Setup */}
      {!result && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Build Your Skill Tree</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Dream Role</Label>
              <Input placeholder="e.g. ML Engineer at Google" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
            </div>
            <div>
              <Label>Your Current Skills</Label>
              <Textarea className="min-h-[120px] text-sm" placeholder="List your skills, projects, tech stack..."
                value={currentSkills} onChange={(e) => setCurrentSkills(e.target.value)} />
            </div>
            <div>
              <Label>Experience Level</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      level === l ? "bg-amber-600 text-white border-amber-600" : "bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-amber-400"
                    }`}>{l.charAt(0).toUpperCase() + l.slice(1)}</button>
                ))}
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading || !targetRole || !currentSkills}
              className="w-full bg-amber-600 hover:bg-amber-700 gap-2 h-12 text-base">
              {loading ? <><Loader /> Generating...</> : <><Trophy className="h-5 w-5" /> Generate Skill Tree</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* XP Header */}
          <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{result.target_role}</h2>
                  <p className="text-sm text-slate-400">{result.nodes.length} skills mapped</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">{result.mastery_percentage}%</p>
                  <p className="text-xs text-slate-400">Mastery</p>
                </div>
              </div>
              <XPBar current={result.current_xp} total={result.total_xp_available} />
              <p className="text-sm text-slate-300 mt-4">{result.skill_gap_summary}</p>
              <Button onClick={() => setResult(null)} variant="outline" size="sm" className="mt-4 text-slate-300 border-slate-600 hover:bg-slate-700">
                ↻ New Tree
              </Button>
            </CardContent>
          </Card>

          {/* Skill Grid by Category */}
          {categories.map((cat) => {
            const nodes = result.nodes.filter((n) => n.category === cat);
            if (nodes.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">{categoryLabels[cat] || cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nodes.map((node) => <SkillNodeCard key={node.id} node={node} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
