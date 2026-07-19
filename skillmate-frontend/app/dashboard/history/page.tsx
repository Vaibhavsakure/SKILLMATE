"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import {
  History, FileText, CheckCircle2, PenTool, Briefcase,
  GraduationCap, Share2, FolderGit2, Map as MapIcon,
  Search, Filter, ChevronRight, Clock, Loader2, Sparkles, BarChart3
} from "lucide-react";
import { getAnalysisHistory, getAnalysisDetail } from "@/lib/api";

interface HistoryItem {
  id: number;
  tool_type: string;
  title: string | null;
  input_summary: string | null;
  score: number | null;
  created_at: string;
}

const TOOL_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  resume_rewrite: { label: "Resume Rewrite", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  ats_score: { label: "ATS Score", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  cover_letter: { label: "Cover Letter", icon: PenTool, color: "text-purple-600", bg: "bg-purple-50" },
  job_match: { label: "Job Match", icon: Briefcase, color: "text-indigo-600", bg: "bg-indigo-50" },
  interview_prep: { label: "Interview Prep", icon: GraduationCap, color: "text-rose-600", bg: "bg-rose-50" },
  linkedin: { label: "LinkedIn", icon: Share2, color: "text-sky-600", bg: "bg-sky-50" },
  project_recommendations: { label: "Projects", icon: FolderGit2, color: "text-amber-600", bg: "bg-amber-50" },
  career_roadmap: { label: "Roadmap", icon: MapIcon, color: "text-teal-600", bg: "bg-teal-50" },
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { getToken, loading: authLoading } = useAuth();

  const loadHistory = async (toolType?: string) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await getAnalysisHistory(token, toolType || undefined);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setDetailLoading(false);
        return;
      }
      const data = await getAnalysisDetail(id, token);
      setSelectedItem(data);
    } catch (err) {
      console.error("Failed to load detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadHistory(filter);
    }
  }, [authLoading]);

  const handleFilterChange = (toolType: string) => {
    setFilter(toolType);
    setSelectedItem(null);
    loadHistory(toolType);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <History className="h-8 w-8 text-indigo-600" />
          Analysis History
        </h1>
        <p className="text-slate-500 mt-1">
          Review your past analyses across all tools. {total > 0 && <span className="text-indigo-600 font-semibold">{total} total</span>}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleFilterChange("")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === "" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All
        </button>
        {Object.entries(TOOL_LABELS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              filter === key ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <val.icon className="h-3.5 w-3.5" />
            {val.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-slate-100 rounded" />
                    <div className="h-3 w-32 bg-slate-50 rounded" />
                  </div>
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
              <Sparkles className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No analyses yet</h3>
              <p className="text-slate-400 text-sm mb-6">Start using the AI tools to see your history here.</p>
              <Link
                href="/dashboard"
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const toolInfo = TOOL_LABELS[item.tool_type] || {
                label: item.tool_type,
                icon: FileText,
                color: "text-slate-600",
                bg: "bg-slate-50",
              };
              const ToolIcon = toolInfo.icon;
              const isSelected = selectedItem?.id === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => loadDetail(item.id)}
                  className={`w-full text-left bg-white rounded-xl border p-5 hover:shadow-md transition-all group ${
                    isSelected
                      ? "border-indigo-300 ring-2 ring-indigo-100 shadow-md"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg ${toolInfo.bg}`}>
                      <ToolIcon className={`h-5 w-5 ${toolInfo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {item.title || toolInfo.label}
                        </h3>
                        {item.score !== null && (
                          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                            item.score >= 75 ? "bg-emerald-50 text-emerald-600" :
                            item.score >= 50 ? "bg-amber-50 text-amber-600" :
                            "bg-red-50 text-red-600"
                          }`}>
                            {item.score}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${toolInfo.bg} ${toolInfo.color}`}>
                          {toolInfo.label}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      {item.input_summary && (
                        <p className="text-xs text-slate-400 mt-2 truncate">{item.input_summary}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm sticky top-24 overflow-hidden">
            {detailLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              </div>
            ) : selectedItem ? (
              <>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5">
                  <h3 className="text-white font-bold">{selectedItem.title || "Analysis Detail"}</h3>
                  <p className="text-indigo-200 text-xs mt-1">{formatDate(selectedItem.created_at)}</p>
                </div>
                <div className="p-5">
                  {selectedItem.score !== null && (
                    <div className="mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-semibold text-slate-700">Score: {selectedItem.score}%</span>
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                      {selectedItem.result_data}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <BarChart3 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Select an analysis to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
