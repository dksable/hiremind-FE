export type Role = "admin" | "hr" | "viewer";

export type User = {
  id?: string;
  email: string;
  name: string;
  role: Role;
  created_at?: string;
};

export type ManagedUser = User & { password?: string };

export type JobPositionStatus = "ongoing" | "on_hold" | "cancelled" | "completed";

export type Job = {
  id: string;
  title: string;
  description: string;
  current_position_status: JobPositionStatus;
  created_at: string;
};

export type CandidateDuplicateMatch = {
  candidate_id: string;
  candidate_name: string | null;
  email: string | null;
  job_id: string | null;
  job_title: string | null;
  status: string | null;
  reasons: string[];
  similarity: number | null;
  applied_for_another_job: boolean;
};

export type CandidateHiringRecommendation = {
  recommendation: "Strong Hire" | "Hire" | "Hold" | "Reject";
  confidence_score: number;
  strengths: string[];
  risks: string[];
  next_action: string;
  summary: string;
  generated_at: string;
};

export type Candidate = {
  id: string;
  job_id: string;
  candidate_name: string | null;
  email: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  cv_url: string | null;
  cv_mime: string | null;
  cv_text?: string | null;
  ats_score: number | null;
  skills_match_percent: number | null;
  matched_skills: string[];
  missing_skills: string[];
  experience_relevance: string | null;
  education_match: string | null;
  recommendation: string | null;
  summary: string | null;
  status: string;
  interview_at: string | null;
  interview_type: string | null;
  interviewer_name: string | null;
  interview_panel_names?: string[];
  interview_panel_emails?: string[];
  meeting_link: string | null;
  interview_notes: string | null;
  duplicate_matches?: CandidateDuplicateMatch[];
  ai_hiring_recommendation?: CandidateHiringRecommendation | null;
  created_at?: string;
};

export type CandidateSortBy = "ats_score" | "skills_match_percent" | "candidate_name" | "created_at" | "status" | "recommendation";
export type SortOrder = "asc" | "desc";
export type CalendarProvider = "manual" | "google" | "microsoft";

export type CalendarIntegrationStatus = {
  google: { provider: "google"; account_email?: string | null; updated_at?: string } | null;
  microsoft: { provider: "microsoft"; account_email?: string | null; updated_at?: string } | null;
};

export type CandidatePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type PaginatedCandidates = {
  data: Candidate[];
  pagination: CandidatePagination;
};

export type CandidateSummary = {
  total: number;
  accepted: number;
  rejected: number;
  scheduled: number;
  pending: number;
  byJob: Array<{ job_id: string; count: number }>;
};

export type Review = {
  id: string;
  candidate_id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  interview_round: string;
  skill_ratings: Array<{ skill: string; rating: number }>;
  rating: number;
  overall_score: number;
  recommendation: "Strong Hire" | "Hire" | "Hold" | "Reject";
  notes: string | null;
  created_at: string;
};

export type CandidateNote = {
  id: string;
  candidate_id: string;
  author_id?: string | null;
  author_name: string;
  author_email?: string | null;
  note: string;
  created_at: string;
};

export type CandidateTimelineEvent = {
  type: "candidate_applied" | "ai_screened" | "status_changed" | "interview_scheduled" | "review_added" | "note_added" | "offer_sent" | "candidate_hired" | string;
  title: string;
  detail: string;
  date: string;
  actor_name?: string | null;
  actor_email?: string | null;
};

export type AuditLog = {
  id: string;
  actor_id?: string;
  actor_email?: string;
  actor_name?: string;
  actor_role?: string;
  action: string;
  resource: string;
  method: string;
  path: string;
  status_code?: number;
  ip?: string;
  user_agent?: string;
  created_value?: unknown;
  updated_value?: unknown;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type HrAnalytics = {
  overview: {
    total_hiring: number;
    total_candidates: number;
    total_jobs: number;
    rejection_percent: number;
    average_ats_score: number;
    interview_conversion_rate: number;
    time_to_hire_days: number;
    time_to_hire_source: "accepted_audit" | "interview_schedule";
  };
  funnel: Array<{ stage: string; count: number }>;
  status_breakdown: Array<{ status: string; count: number }>;
  ats_distribution: Array<{ range: string; count: number }>;
  monthly_trend: Array<{ month: string; applications: number; hired: number; rejected: number; interviews: number }>;
  hiring_by_job: Array<{
    job_id: string;
    title: string;
    candidates: number;
    accepted: number;
    rejected: number;
    average_ats_score: number;
  }>;
  recent_hires: Array<{
    id: string;
    candidate_name: string;
    email: string | null;
    job_title: string;
    ats_score: number;
  }>;
};

export type ScreeningAnalysis = Pick<
  Candidate,
  | "candidate_name"
  | "email"
  | "ats_score"
  | "skills_match_percent"
  | "matched_skills"
  | "missing_skills"
  | "experience_relevance"
  | "education_match"
  | "recommendation"
  | "summary"
>;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "hiremind_token";

export function apiUrl(path: string) {
  return `${API_URL}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new Error("Unable to reach the server. Please check that the backend is running and try again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({} as { error?: string }));
    const fallback = response.status === 429
      ? "Too many requests. Please wait a moment and try again."
      : response.status >= 500
        ? "Server error. Please try again shortly."
        : `Request failed (${response.status})`;
    throw new Error(data.error || fallback);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      const data = await request<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      return data;
    },
    me: () => request<{ user: User }>("/api/auth/me"),
    register: (payload: ManagedUser) =>
      request<{ token: string; user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  users: {
    list: () => request<User[]>("/api/users"),
    create: (payload: ManagedUser) => request<User>("/api/users", { method: "POST", body: JSON.stringify(payload) }),
    update: (email: string, patch: Partial<ManagedUser>) =>
      request<User>(`/api/users/${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (email: string) => request<void>(`/api/users/${encodeURIComponent(email)}`, { method: "DELETE" }),
  },
  jobs: {
    list: () => request<Job[]>("/api/jobs"),
    create: (payload: Pick<Job, "title" | "description">) =>
      request<Job>("/api/jobs", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, patch: Partial<Pick<Job, "current_position_status">>) =>
      request<Job>(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) => request<void>(`/api/jobs/${id}`, { method: "DELETE" }),
  },
  candidates: {
    list: (jobId?: string) => request<Candidate[]>(`/api/candidates${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`),
    paginated: (params: { page: number; limit: number; jobId?: string; status?: string; search?: string; sortBy?: CandidateSortBy; sortOrder?: SortOrder }) => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.jobId) searchParams.set("jobId", params.jobId);
      if (params.status && params.status !== "all") searchParams.set("status", params.status);
      if (params.search?.trim()) searchParams.set("search", params.search.trim());
      if (params.sortBy) searchParams.set("sortBy", params.sortBy);
      if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
      return request<PaginatedCandidates>(`/api/candidates?${searchParams.toString()}`);
    },
    summary: () => request<CandidateSummary>("/api/candidates/summary"),
    create: (formData: FormData) => request<Candidate>("/api/candidates", { method: "POST", body: formData }),
    update: (id: string, patch: Partial<Candidate>) =>
      request<Candidate>(`/api/candidates/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) => request<void>(`/api/candidates/${id}`, { method: "DELETE" }),
    timeline: (id: string) => request<CandidateTimelineEvent[]>(`/api/candidates/${id}/timeline`),
    recommendation: (id: string) =>
      request<CandidateHiringRecommendation>(`/api/candidates/${id}/recommendation`, { method: "POST" }),
    cvUrl: (candidate: Candidate) => candidate.cv_url ? apiUrl(candidate.cv_url) : "",
  },
  reviews: {
    list: (candidateId: string) => request<Review[]>(`/api/candidates/${candidateId}/reviews`),
    add: (candidateId: string, payload: Pick<Review, "reviewer_name" | "reviewer_email" | "interview_round" | "skill_ratings" | "notes">) =>
      request<Review>(`/api/candidates/${candidateId}/reviews`, { method: "POST", body: JSON.stringify(payload) }),
    remove: (candidateId: string, reviewId: string) =>
      request<void>(`/api/candidates/${candidateId}/reviews/${reviewId}`, { method: "DELETE" }),
  },
  notes: {
    list: (candidateId: string) => request<CandidateNote[]>(`/api/candidates/${candidateId}/notes`),
    add: (candidateId: string, payload: Pick<CandidateNote, "note">) =>
      request<CandidateNote>(`/api/candidates/${candidateId}/notes`, { method: "POST", body: JSON.stringify(payload) }),
    remove: (candidateId: string, noteId: string) =>
      request<void>(`/api/candidates/${candidateId}/notes/${noteId}`, { method: "DELETE" }),
  },
  auditLogs: {
    list: (limit = 100) => request<AuditLog[]>(`/api/audit-logs?limit=${limit}`),
  },
  analytics: {
    hr: () => request<HrAnalytics>("/api/analytics/hr"),
  },
  screenCV: (payload: { jobDescription: string; cvText: string }) =>
    request<ScreeningAnalysis>("/api/screen-cv", { method: "POST", body: JSON.stringify(payload) }),
  integrations: {
    status: () => request<CalendarIntegrationStatus>("/api/integrations/status"),
    connectUrl: (provider: Exclude<CalendarProvider, "manual">) =>
      request<{ url: string }>(`/api/integrations/${provider}/connect-url`),
    disconnect: (provider: Exclude<CalendarProvider, "manual">) =>
      request<void>(`/api/integrations/${provider}`, { method: "DELETE" }),
  },
};
