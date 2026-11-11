import type { Bullet, Fact, FactStatus, Keyword, Requirement, Source } from "./data";

export const API = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

export interface ScoreComponent { key: string; value: number; color: string; weight: number; why: string; scored?: boolean }
export interface ScoringProfile { id: string; label: string; desc: string; weights: { K: number; J: number; E: number; Q: number; A: number }; pref_share: number }
export interface Recommendation {
  n: number;
  title: string;
  impact: string;
  detail: string;
  verified?: boolean;
  suggested_bullet?: string;
  project?: string;
  action_type?: string;
  keyword_id?: string;
  fact_id?: string;
}
export interface ApiProject {
  id?: string;
  name: string;
  kind?: "role" | "project";
  relevance: number;
  picked: boolean;
  bullets?: number;
  why?: string;
  manual?: boolean;
}
export interface Eligibility {
  status: "eligible" | "needs_review";
  items: string[];
  gaps: string[];
  note: string;
}
export interface ApiBullet extends Bullet { issues?: string[]; kind?: "role" | "project"; user?: boolean }
export interface ApiKeyword extends Keyword { canon?: string }
export interface JobView {
  id: number;
  meta: { title: string; company: string; seniority: string; keywords: string[] };
  jd: string;
  requirements: Requirement[];
  projects: ApiProject[];
  resume: { summary: string; bullets: ApiBullet[]; skills: string[]; verifier_log: { bullet: string; attempts: number; mode: string }[] };
  keywords: ApiKeyword[];
  chat: { from: string; text: string }[];
  score: { total: number; components: ScoreComponent[]; missing_must: string[] };
  recommendations: Recommendation[];
  profile?: ScoringProfile;
  profiles?: ScoringProfile[];
  eligibility?: Eligibility;
  mode: "agent" | "rules";
}
export interface ActivityStep { id: number; agent: string; tech: string; note: string; elapsed_ms?: number; ms?: number; state?: string; mode?: string; api?: string; model?: string; at?: number }
export interface Activity { running: ActivityStep[]; recent: ActivityStep[]; llm: boolean; model: string; crewai: string; adk: string }
export interface Profile {
  name: string;
  email: string;
  links: string;
  location: string;
  education?: string;
  degree?: string;
  university?: string;
  cgpa?: string;
  phone?: string;
  experience_years?: number | null;
  auto_confirm?: boolean;
}
export interface ExtractedResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  degree: string;
  university: string;
  cgpa: string;
  grad_years: string;
  education_summary: string;
  skills: string[];
  experience: { company: string; period: string; role: string }[];
  github_user: string;
}
export interface IngestResult {
  source: Source;
  warnings: string[];
  added: number;
  stale: number;
  mode: string;
  unchanged: boolean;
  github?: { profiles: string[]; repos: string[] };
  extracted?: ExtractedResumeData;
}
export interface RepoInfo { repo: string; description: string; language: string; stars: number; pushed: string; added: boolean; fork?: boolean; is_owner?: boolean }

export interface AuditEvent { id: number; at: number; kind: string; source: string; note: string; status: string; ms: number; api?: string }
export interface AuditResult { events: AuditEvent[]; stats: Record<string, number> }

const TOKEN_KEY = "skillora_token";
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } };
export const setToken = (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} };
export const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} };

async function call<T>(path: string, init?: RequestInit, timeoutMs = 180000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const auth: Record<string, string> = getToken() ? { Authorization: `Bearer ${getToken()}` } : {};
    const headers = init?.body instanceof FormData ? auth : { "Content-Type": "application/json", ...auth, ...((init?.headers as Record<string, string>) ?? {}) };
    const r = await fetch(API + path, { ...init, signal: ctl.signal, headers });
    if (r.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
      clearToken();
      window.location.href = "/login";
    }
    if (!r.ok) {
      let msg = r.statusText;
      try { msg = (await r.json()).detail ?? msg; } catch {}
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
const post = <T,>(p: string, body?: unknown, ms?: number) => call<T>(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, ms);
const patch = <T,>(p: string, body: unknown) => call<T>(p, { method: "PATCH", body: JSON.stringify(body) });

export interface AuthResult { token: string; user: Profile }

export const api = {
  signup: (email: string, password: string, name: string) => post<AuthResult>("/api/auth/signup", { email, password, name }, 20000),
  login: (email: string, password: string) => post<AuthResult>("/api/auth/login", { email, password }, 20000),
  me: () => call<Profile>("/api/auth/me", undefined, 8000),
  health: () => call<{ ok: boolean; llm: boolean; models: string[]; crewai: string; google_adk: string }>("/api/health", undefined, 3500),
  sources: () => call<Source[]>("/api/sources"),
  facts: () => call<Fact[]>("/api/facts"),
  activity: () => call<Activity>("/api/activity", undefined, 4000),
  audit: (kind?: string) => call<AuditResult>(`/api/audit${kind ? `?kind=${kind}` : ""}`, undefined, 4000),
  profile: () => call<Profile>("/api/profile"),
  resumeExtracted: () => call<ExtractedResumeData>("/api/profile/resume-extracted"),
  eduHint: () => call<{ degree: string; college: string; years: string } | null>("/api/education-hint", undefined, 8000),
  saveProfile: (p: Profile) => call<Profile>("/api/profile", { method: "PUT", body: JSON.stringify(p) }),
  githubRepos: (user: string) => call<RepoInfo[]>(`/api/github/repos?user_name=${encodeURIComponent(user)}`, undefined, 30000),
  addGithub: (repo: string) => post<IngestResult>("/api/sources/github", { repo }, 240000),
  addNote: (name: string, text: string) => post<IngestResult>("/api/sources/note", { name, text }, 240000),
  upload: (file: File, sourceId?: string) => { const f = new FormData(); f.append("file", file); if (sourceId) f.append("source_id", sourceId.replace(/^s/, "")); return call<IngestResult>("/api/sources/upload", { method: "POST", body: f }, 240000); },
  resync: (id: string) => post<IngestResult>(`/api/sources/${id.replace(/^s/, "")}/resync`, undefined, 240000),
  removeSource: (id: string) => call<{ ok: boolean }>(`/api/sources/${id.replace(/^s/, "")}`, { method: "DELETE" }),
  setFact: (id: string, status: FactStatus) => patch<Fact>(`/api/facts/${id}`, { status }),
  editFact: (id: string, text: string) => patch<Fact>(`/api/facts/${id}`, { text }),
  deleteFact: (id: string) => call<{ deleted: string }>(`/api/facts/${id}`, { method: "DELETE" }),
  createFact: (data: { project: string; category: string; text: string; span?: string; status?: FactStatus }) => post<Fact>("/api/facts", data),
  verifyProject: (project: string) => post<{ updated: number; project: string }>("/api/facts/project/verify", { project }),
  unverifyProject: (project: string) => post<{ updated: number; project: string }>("/api/facts/project/unverify", { project }),
  deleteProject: (project: string) => call<{ ok: boolean; project: string }>(`/api/facts/project/${encodeURIComponent(project)}`, { method: "DELETE" }),
  bulk: (project: string | null, status: "verified" | "rejected" = "verified", scope: "pending" | "all" = "pending") => post<{ updated: number }>("/api/facts/bulk", { project, status, scope }),
  declare: (skill: string) => post<Fact>("/api/facts/declare", { skill }),
  latestJob: () => call<JobView | null>("/api/jobs/latest"),
  analyze: (jd: string) => post<JobView>("/api/jobs", { jd }, 300000),
  toggleProject: (job: number, pid: string) => post<JobView>(`/api/jobs/${job}/projects/${pid}/toggle`),
  undo: (job: number) => post<JobView>(`/api/jobs/${job}/undo`),
  regenerate: (job: number) => post<JobView>(`/api/jobs/${job}/resume`, undefined, 300000),
  editBullet: (job: number, bid: string, text: string) => patch<JobView>(`/api/jobs/${job}/bullets/${bid}`, { text }),
  addBullet: (job: number, project: string, text: string, verified: boolean = true) => post<JobView>(`/api/jobs/${job}/bullets`, { project, text, verified }),
  editSummary: (job: number, text: string) => patch<JobView>(`/api/jobs/${job}/summary`, { text }),
  setScoreProfile: (job: number, profile: string) => call<JobView>(`/api/jobs/${job}/profile`, { method: "PUT", body: JSON.stringify({ profile }) }),
  decideKeyword: (job: number, kid: string, accept: boolean) => post<JobView>(`/api/jobs/${job}/keywords/${kid}`, { accept }),
  chat: (job: number, message: string) => post<{ reply: string; mode: string; job: JobView }>(`/api/jobs/${job}/chat`, { message }, 240000),
  preflight: (job: number) => call<{ checks: { ok: boolean; text: string }[]; bullets: number; blocked: number; score: number }>(`/api/jobs/${job}/export/preflight`),
  exportUrl: (job: number, fmt: "pdf" | "docx") => `${API}/api/jobs/${job}/export?format=${fmt}`,
  evalRun: () => call<{ metrics: { label: string; value: number; detail: string }[]; note: string }>("/api/eval"),
};
