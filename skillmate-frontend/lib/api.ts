import axios from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api/python";

export const api = axios.create({ baseURL: BASE_URL });

// ========== GLOBAL USER CONTEXT ==========

export type UserContextResponse = {
  resume_text: string | null;
  resume_filename: string | null;
  job_description: string | null;
  jd_title: string | null;
  has_resume: boolean;
  has_jd: boolean;
  resume_char_count: number;
  jd_char_count: number;
};

export const getUserContext = async (token: string): Promise<UserContextResponse> => {
  return (await api.get("/context/", { headers: { Authorization: `Bearer ${token}` } })).data;
};

export const saveUserContext = async (
  data: { resume_text?: string; job_description?: string; jd_title?: string },
  token: string,
): Promise<UserContextResponse> => {
  return (await api.post("/context/save", data, { headers: { Authorization: `Bearer ${token}` } })).data;
};

export const uploadResumeToContext = async (
  file: File,
  token: string,
): Promise<UserContextResponse> => {
  const formData = new FormData();
  formData.append("resume_file", file);
  return (await api.post("/context/upload-resume", formData, { headers: { Authorization: `Bearer ${token}` } })).data;
};

// Shared types
export type ATSResponse = {
  score: number;
  missing_keywords: string[];
  suggestions: string[];
};

type JsonRecord = Record<string, any>;

// Resume Rewrite
export const rewriteResume = async (
  formData: FormData,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/resume/rewrite", formData, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// ATS Score
export const scanATS = async (
  formData: FormData,
  token: string,
): Promise<ATSResponse> => {
  return (
    await api.post("/ats/score", formData, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as ATSResponse;
};

// Job Match
export const jobMatch = async (
  data: JsonRecord,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/jobs/analyze", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// Interview Prep
export const interviewPrep = async (
  data: JsonRecord,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/interview/generate-questions", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// Cover Letter
export const generateCoverLetter = async (
  data: JsonRecord,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/cover-letter/generate", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// LinkedIn Optimization
export const optimizeLinkedIn = async (
  data: JsonRecord,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/linkedin/optimize", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// Projects
export type ProjectRecommendationsRequest = {
  resume_text: string;
  job_description: string;
};

export const getProjectRecommendations = async (
  data: ProjectRecommendationsRequest,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/projects/recommend-projects", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// Credits System
export type CreditBalanceResponse = { credits: number };

export const getCreditBalance = async (
  token: string,
): Promise<CreditBalanceResponse> => {
  return (
    await api.get("/credits/balance", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as CreditBalanceResponse;
};

export type CreditHistoryItem = {
  id: number;
  change: number;
  reason: string;
  created_at: string;
};

export type CreditHistoryResponse = {
  transactions: CreditHistoryItem[];
};

export const getCreditHistory = async (
  token: string,
): Promise<CreditHistoryResponse> => {
  return (
    await api.get("/credits/history", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as CreditHistoryResponse;
};

// Career Roadmap
export type RoadmapRequest = {
  target_role: string;
  current_skills?: string;
};

export const generateRoadmap = async (
  data: RoadmapRequest,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/roadmap/generate", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// AI Chatbot
export type ChatMessage = { role: string; content: string };

export const sendChatMessage = async (
  history: ChatMessage[],
  message: string,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post(
      "/chat/send",
      { message, history },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
  ).data as JsonRecord;
};

// ========== NEW FEATURES ==========

// Dashboard Stats
export const getStatsOverview = async (token: string) => {
  return (await api.get("/stats/overview", {
    headers: { "Authorization": `Bearer ${token}` },
  })).data;
};

// Analysis History
export const getAnalysisHistory = async (token: string, toolType?: string, limit = 20, offset = 0) => {
  const params = new URLSearchParams();
  if (toolType) params.append("tool_type", toolType);
  params.append("limit", String(limit));
  params.append("offset", String(offset));
  return (await api.get(`/history/?${params.toString()}`, {
    headers: { "Authorization": `Bearer ${token}` },
  })).data;
};

export const getAnalysisDetail = async (id: number, token: string) => {
  return (await api.get(`/history/${id}`, {
    headers: { "Authorization": `Bearer ${token}` },
  })).data;
};

// PDF Export
export const exportPDF = async (data: { content: string, title: string, doc_type?: string }, token: string) => {
  const response = await api.post("/export/pdf", data, {
    headers: { "Authorization": `Bearer ${token}` },
    responseType: "blob",
  });
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${data.title || "Skillmate_Document"}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Resume File Parse
export const parseResumeFile = async (file: File, token: string) => {
  const formData = new FormData();
  formData.append("resume_file", file);
  formData.append("job_description", "parse only");
  return (await api.post("/resume/rewrite", formData, {
    headers: { "Authorization": `Bearer ${token}` },
  })).data;
};

// Streaming Rewrite — returns a ReadableStream
export const rewriteResumeStream = async (
  formData: FormData,
  token: string,
): Promise<ReadableStream<Uint8Array> | null> => {
  const response = await fetch(`${BASE_URL}/resume/rewrite-stream`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Stream failed");
  }

  return response.body;
};

// ========== VOICE INTERVIEW SIMULATOR (WebSocket) ==========

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL?.trim() || "ws://127.0.0.1:8000";

export interface VoiceInterviewConfig {
  job_title: string;
  resume_text: string;
  difficulty: "easy" | "medium" | "hard";
  total_questions?: number;
}

export interface InterviewAnswerResult {
  score: number;
  feedback: string;
  follow_up: string | null;
  next_question: string | null;
  next_category: string | null;
  question_number: number;
  total_questions: number;
  is_complete: boolean;
}

export interface InterviewReportData {
  overall_score: number;
  communication_score: number;
  technical_score: number;
  confidence_score: number;
  problem_solving_score: number;
  strengths: string[];
  improvements: string[];
  summary: string;
  duration_seconds: number;
  answers_detail: Array<{
    question: string;
    category: string;
    answer: string;
    score: number;
    feedback: string;
  }>;
}

export type WSMessageType =
  | "session_start"
  | "answer_result"
  | "interview_complete"
  | "evaluating"
  | "generating_report"
  | "error"
  | "pong";

export interface WSIncomingMessage {
  type: WSMessageType;
  data: Record<string, any>;
}

/**
 * Creates a WebSocket connection to the Voice Interview Simulator.
 * Returns the WebSocket instance for full control.
 */
export const createInterviewWebSocket = (token: string): WebSocket => {
  const url = `${WS_BASE_URL}/ws/interview?token=${encodeURIComponent(token)}`;
  return new WebSocket(url);
};

// ========== REST INTERVIEW SIMULATOR ==========

export interface InterviewStartRequest {
  job_title: string;
  resume_text: string;
  difficulty?: string;
}

export interface InterviewStartResponse {
  session_id: string;
  question: string;
  question_number: number;
  total_questions: number;
  category: string;
}

export interface InterviewAnswerRequest {
  session_id: string;
  question: string;
  answer: string;
  question_number: number;
  job_title: string;
  resume_text: string;
}

export interface InterviewFinishRequest {
  session_id: string;
  job_title: string;
  answers: Array<{ question: string; answer: string; score: number }>;
}

export const startInterviewSession = async (
  data: InterviewStartRequest,
  token: string,
): Promise<InterviewStartResponse> => {
  return (
    await api.post("/interview/start-session", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as InterviewStartResponse;
};

export const submitInterviewAnswer = async (
  data: InterviewAnswerRequest,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/interview/answer", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

export const finishInterview = async (
  data: InterviewFinishRequest,
  token: string,
): Promise<JsonRecord> => {
  return (
    await api.post("/interview/finish", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JsonRecord;
};

// ========== X-RAY ATS SEMANTIC ANALYZER ==========

export interface SentenceAnalysis {
  original: string;
  suggestion: string | null;
  reason: string | null;
  strength: "strong" | "moderate" | "weak";
  category: "impact" | "clarity" | "keywords" | "metrics" | "relevance";
  score: number;
}

export interface XRayATSResponse {
  overall_score: number;
  keyword_score: number;
  impact_score: number;
  clarity_score: number;
  total_sentences: number;
  weak_count: number;
  strong_count: number;
  sentences: SentenceAnalysis[];
  missing_keywords: string[];
  summary: string;
}

export const xrayATSAnalysis = async (
  formData: FormData,
  token: string,
): Promise<XRayATSResponse> => {
  return (
    await api.post("/ats/xray", formData, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as XRayATSResponse;
};

// ========== GAMIFIED SKILL TREE ==========

export interface LearningResource {
  title: string;
  url: string;
  platform: string;
  duration: string;
  type: string;
}

export interface SkillNode {
  id: string;
  name: string;
  category: "foundation" | "core" | "advanced" | "specialist";
  status: "mastered" | "in_progress" | "locked" | "recommended";
  xp_reward: number;
  current_level: number;
  max_level: number;
  description: string;
  prerequisites: string[];
  resources: LearningResource[];
}

export interface SkillTreeResponse {
  target_role: string;
  total_xp_available: number;
  current_xp: number;
  mastery_percentage: number;
  skill_gap_summary: string;
  categories: string[];
  nodes: SkillNode[];
  recommended_path: string[];
}

export interface SkillTreeRequest {
  target_role: string;
  current_skills: string;
  experience_level?: string;
}

export const generateSkillTree = async (
  data: SkillTreeRequest,
  token: string,
): Promise<SkillTreeResponse> => {
  return (
    await api.post("/skill-tree/generate", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as SkillTreeResponse;
};

// ========== AI ACHIEVEMENT EXTRACTOR ==========

export interface EnhancedBullet {
  original: string;
  enhanced: string;
  metrics_added: string[];
  action_verb_before: string;
  action_verb_after: string;
  impact_score_before: number;
  impact_score_after: number;
  reasoning: string;
  category: "metrics" | "verb_upgrade" | "specificity" | "quantification";
}

export interface EnhanceBulletResponse {
  result: EnhancedBullet;
  status: string;
}

export interface EnhanceAllResponse {
  results: EnhancedBullet[];
  total_bullets: number;
  avg_score_before: number;
  avg_score_after: number;
  total_improvement: number;
  status: string;
}

export const enhanceBullet = async (
  data: { bullet: string; job_context?: string; tone?: string },
  token: string,
): Promise<EnhanceBulletResponse> => {
  return (
    await api.post("/resume/enhance-bullet", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as EnhanceBulletResponse;
};

export const enhanceAllBullets = async (
  data: { bullets: string[]; job_context?: string; tone?: string },
  token: string,
): Promise<EnhanceAllResponse> => {
  return (
    await api.post("/resume/enhance-all", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as EnhanceAllResponse;
};

// ========== LATEX RESUME BUILDER ==========

export interface LatexResumeRequest {
  resume_text: string;
  job_description?: string;
  template?: string;
}

export interface LatexResumeResponse {
  latex_code: string;
  parsed_sections: Record<string, any>;
  template_used: string;
  status: string;
}

export const generateLatexResume = async (
  data: LatexResumeRequest,
  token: string,
): Promise<LatexResumeResponse> => {
  return (
    await api.post("/latex-resume/generate", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as LatexResumeResponse;
};

// ========== RECRUITER PORTAL ==========

export interface CreateJobRequest {
  title: string;
  company_name?: string;
  jd_text: string;
  required_skills?: string;
  experience_level?: string;
  score_threshold?: number;
  calendly_link?: string;
}

export interface CreateJobResponse {
  id: string;
  title: string;
  is_active: boolean;
  message: string;
}

export interface CandidateData {
  id: number;
  applicant_name: string | null;
  applicant_email: string | null;
  cv_filename: string | null;
  overall_score: number;
  skills_match: number;
  experience_fit: number;
  red_flags: string[];
  green_flags: string[];
  summary: string | null;
  recommendation: string;
  status: string;
  source: string;
}

export interface ScreenResponse {
  job_id: string;
  candidates_screened: number;
  candidates: CandidateData[];
}

export interface ShortlistResponse {
  job_id: string;
  job_title: string;
  company_name: string | null;
  score_threshold: number;
  total_candidates: number;
  candidates: CandidateData[];
}

export interface ActionResponse {
  candidate_id: number;
  new_status: string;
  email_sent: boolean;
  message: string;
}

export interface JobSummary {
  id: string;
  title: string;
  company_name: string | null;
  is_active: boolean;
  candidate_count: number;
  shortlisted: number;
  avg_score: number;
  created_at: string;
}

export interface RecruiterDashboardData {
  active_jobs: number;
  total_jobs: number;
  total_candidates: number;
  shortlisted: number;
  rejected: number;
  shortlist_rate: number;
  estimated_hours_saved: number;
  jobs: JobSummary[];
}

export const createRecruiterJob = async (
  data: CreateJobRequest,
  token: string,
): Promise<CreateJobResponse> => {
  return (
    await api.post("/recruiter/jobs", data, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as CreateJobResponse;
};

export const screenCandidates = async (
  jobId: string,
  files: File[],
  token: string,
): Promise<ScreenResponse> => {
  const formData = new FormData();
  formData.append("job_id", jobId);
  files.forEach((f) => formData.append("resume_files", f));
  return (
    await api.post("/recruiter/screen", formData, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as ScreenResponse;
};

export const getShortlist = async (
  jobId: string,
  token: string,
  statusFilter?: string,
  recommendationFilter?: string,
): Promise<ShortlistResponse> => {
  const params = new URLSearchParams();
  if (statusFilter) params.append("status_filter", statusFilter);
  if (recommendationFilter) params.append("recommendation_filter", recommendationFilter);
  return (
    await api.get(`/recruiter/shortlist/${jobId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as ShortlistResponse;
};

export const candidateAction = async (
  candidateId: number,
  action: "approve" | "reject",
  token: string,
  customMessage?: string,
): Promise<ActionResponse> => {
  return (
    await api.post(
      "/recruiter/action",
      { candidate_id: candidateId, action, custom_message: customMessage },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data as ActionResponse;
};

export const getRecruiterDashboard = async (
  token: string,
): Promise<RecruiterDashboardData> => {
  return (
    await api.get("/recruiter/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as RecruiterDashboardData;
};

// ========== JOB BOARD (Job Seekers) ==========

export interface JobBoardItem {
  id: string;
  title: string;
  company_name: string | null;
  experience_level: string | null;
  required_skills: string | null;
  jd_preview: string;
  created_at: string;
  is_active: boolean;
}

export interface JobBoardDetail {
  id: string;
  title: string;
  company_name: string | null;
  experience_level: string | null;
  required_skills: string | null;
  jd_text: string;
  created_at: string;
  is_active: boolean;
  match_score: number | null;
}

export interface ApplyResponse {
  candidate_id: number;
  job_title: string;
  match_score: number;
  status: string;
  message: string;
}

export interface MyApplication {
  id: number;
  job_id: string;
  job_title: string;
  company_name: string | null;
  overall_score: number;
  recommendation: string;
  status: string;
  applied_at: string;
}

export const getJobBoard = async (
  search?: string,
  experience?: string,
): Promise<JobBoardItem[]> => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (experience) params.append("experience", experience);
  return (await api.get(`/jobs/board?${params.toString()}`)).data as JobBoardItem[];
};

export const getJobDetail = async (
  jobId: string,
  token: string,
): Promise<JobBoardDetail> => {
  return (
    await api.get(`/jobs/board/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as JobBoardDetail;
};

export const applyToJob = async (
  jobId: string,
  token: string,
): Promise<ApplyResponse> => {
  return (
    await api.post(`/jobs/apply/${jobId}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as ApplyResponse;
};

export const getMyApplications = async (
  token: string,
): Promise<MyApplication[]> => {
  return (
    await api.get("/jobs/my-applications", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as MyApplication[];
};

// ========== USER ROLE ==========

export interface UserRoleResponse {
  role: string;
  email: string;
  user_id: string;
}

export interface SetRoleResponse {
  role: string;
  message: string;
}

export const getUserRole = async (
  token: string,
): Promise<UserRoleResponse> => {
  return (
    await api.get("/users/me/role", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data as UserRoleResponse;
};

export const setUserRole = async (
  role: string,
  token: string,
): Promise<SetRoleResponse> => {
  return (
    await api.post(
      "/users/me/role",
      { role },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data as SetRoleResponse;
};