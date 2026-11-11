"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  chatSeed, initialBullets, initialFacts, initialKeywords, projects as seedProjects, recommendations as seedRecs, requirements as seedReqs,
  resumeSummary, scoreComponents, sources as seedSources, jobMeta,
  type Fact, type FactStatus, type Source,
} from "./data";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken, setToken, type Eligibility, type ScoringProfile, type ApiBullet, type ApiKeyword, type ApiProject, type JobView, type Profile, type Recommendation, type ScoreComponent } from "./api";

/**
 * One store for every screen. When the FastAPI backend is reachable (`live`) all data comes from it
 * (CrewAI + Google ADK agents behind the API). If it is not, the same screens run on the bundled demo
 * dataset so a presentation never breaks.
 */
interface Store {
  live: boolean;
  ready: boolean;
  busy: string; // label of the long-running agent step, "" when idle
  error: string;
  notice: string;
  llm: boolean;
  profile: Profile;
  saveProfile: (p: Profile) => Promise<void>;
  logout: () => void;

  sources: Source[];
  refreshLedger: () => Promise<void>;
  addGithub: (repo: string) => Promise<string>;
  addNote: (name: string, text: string) => Promise<string>;
  upload: (f: File) => Promise<string>;
  removeSource: (id: string) => Promise<void>;
  resync: (id: string) => Promise<string>;
  reupload: (id: string, f: File) => Promise<string>;
  found: { profiles: string[]; repos: string[] };
  clearFound: () => void;

  facts: Fact[];
  setFactStatus: (id: string, s: FactStatus) => Promise<void>;
  editFact: (id: string, text: string) => Promise<void>;
  deleteFact: (id: string) => Promise<void>;
  createFact: (data: { project: string; category: string; text: string; span?: string; status?: FactStatus }) => Promise<void>;
  verifyProject: (project: string) => Promise<void>;
  unverifyProject: (project: string) => Promise<void>;
  deleteProject: (project: string) => Promise<void>;
  declareSkill: (skill: string) => Promise<void>;
  confirmGroup: (project: string | null) => Promise<void>;
  rejectGroup: (project: string) => Promise<void>;

  analyzed: boolean;
  jd: string;
  analyze: (jd: string) => Promise<void>;
  meta: { title: string; company: string; seniority: string; keywords: string[] };
  requirements: JobView["requirements"];
  projects: ApiProject[];
  toggleProject: (id: string) => Promise<void>;
  summary: string;
  bullets: ApiBullet[];
  skills: string[];
  setBullets: (b: ApiBullet[]) => void;
  editBullet: (id: string, text: string) => Promise<void>;
  addBullet: (project: string, text: string, verified?: boolean) => Promise<void>;
  editSummary: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  undo: () => Promise<void>;
  keywords: ApiKeyword[];
  decideKeyword: (id: string, accept: boolean) => Promise<void>;
  chat: { from: string; text: string }[];
  sendChat: (m: string) => Promise<void>;
  score: number;
  scoreProfile: ScoringProfile | null;
  profiles: ScoringProfile[];
  setScoreProfile: (id: string) => Promise<void>;
  eligibility: Eligibility | null;
  components: ScoreComponent[];
  recs: Recommendation[];
  jobId: number | null;
  mode: "agent" | "rules" | "demo";
}

const Ctx = createContext<Store | null>(null);
const demoProfile: Profile = {
  name: "",
  email: "",
  phone: "",
  links: "",
  location: "",
  degree: "",
  university: "",
  cgpa: "",
  education: "",
  experience_years: null,
};
const emptyMeta = { title: "", company: "", seniority: "", keywords: [] as string[] };

export function StoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [llm, setLlm] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [sources, setSources] = useState<Source[]>(seedSources);
  const [facts, setFacts] = useState<Fact[]>(initialFacts);
  const [job, setJob] = useState<JobView | null>(null);
  const [jd, setJd] = useState("");
  const [found, setFound] = useState<{ profiles: string[]; repos: string[] }>({ profiles: [], repos: [] });

  // demo-mode local state
  const [dBullets, setDBullets] = useState<ApiBullet[]>(initialBullets);
  const [dKeywords, setDKeywords] = useState<ApiKeyword[]>(initialKeywords);
  const [dProjects, setDProjects] = useState<ApiProject[]>(seedProjects);
  const [dChat, setDChat] = useState(chatSeed);
  const [dAnalyzed, setDAnalyzed] = useState(false);
  const [dSummary, setDSummary] = useState(resumeSummary);

  const refreshLedger = useCallback(async () => {
    const [s, f] = await Promise.all([api.sources(), api.facts()]);
    setSources(s);
    setFacts(f);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        let tok = getToken();
        if (!tok) {
          router.replace("/login"); // no saved login: ask the user to sign in (never auto-login as someone else)
          return;
        }
        setLive(true);
        setLlm(h.llm);
        const [, p, j] = await Promise.all([refreshLedger(), api.profile(), api.latestJob()]);
        setProfile(p);
        if (j) { setJob(j); setJd(j.jd); }
      } catch {
        setLive(false);  // backend offline
      }
      setReady(true);
    })();
  }, [refreshLedger, router]);

  /** Run an API action with a busy label and uniform error handling. */
  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(label);
    setError("");
    try { return await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(""); }
  }, []);

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(""), 6000); };

  const reloadJob = useCallback(async (j?: JobView | null) => {
    if (j) setJob(j);
    else if (job) setJob(await api.latestJob());
  }, [job]);

  const value = useMemo<Store>(() => {
    const isAnalyzed = live ? !!job : dAnalyzed;
    const verified = facts.filter((f) => f.status === "verified").length;
    const accepted = dKeywords.filter((k) => k.state === "accepted").length;
    const boost = Math.max(0, Math.min(verified - 5, 5)) + accepted * 2;
    const demoScore = isAnalyzed ? Math.max(60, Math.min(98, 74 + boost)) : 0;
    const defaultComps = scoreComponents.map((c) => ({ ...c, value: 0, why: "Awaiting job analysis." }));
    const demoComps = isAnalyzed
      ? scoreComponents.map((c, i) => ({ ...c, value: Math.min(99, 70 + (i === 3 || i === 0 ? boost : Math.round(boost / 2))) }))
      : defaultComps;

    const ingestMsg = (r: { added: number; stale: number; mode: string; warnings: string[]; unchanged: boolean }) =>
      r.unchanged ? "No change since last time - nothing re-extracted." :
      `Extracted ${r.added} new fact${r.added === 1 ? "" : "s"} (${r.mode === "agent" ? "CrewAI agent" : "rule-based fallback"})` +
      (r.stale ? `, ${r.stale} marked stale` : "") + (r.warnings.length ? ` - note: ${r.warnings.join(", ")}` : "") + ". Review them on Verify Facts.";

    return {
      live, ready, busy, error, notice, llm, profile,
      logout: () => { clearToken(); window.location.href = "/login"; },
      saveProfile: async (p) => { setProfile(p); if (live) await run("Saving", () => api.saveProfile(p)); },

      sources,
      refreshLedger,
      addGithub: async (repo) => { const r = await run("Source Extractor agent is reading the repo", () => api.addGithub(repo)); if (!r) return ""; await refreshLedger(); const m = ingestMsg(r); flash(m); return m; },
      addNote: async (name, text) => { const r = await run("Source Extractor agent is reading the note", () => api.addNote(name, text)); if (!r) return ""; await refreshLedger(); const m = ingestMsg(r); flash(m); return m; },
      upload: async (f) => {
        const r = await run("Parsing file and extracting facts", () => api.upload(f));
        if (!r) return "";
        setFound(r.github ?? { profiles: [], repos: [] });
        await refreshLedger();
        if (r.extracted) {
          setProfile((prev) => ({
            ...prev,
            name: r.extracted?.name || prev.name,
            phone: r.extracted?.phone || prev.phone,
            location: r.extracted?.location || prev.location,
            education: r.extracted?.education_summary || prev.education,
            degree: r.extracted?.degree || prev.degree,
            university: r.extracted?.university || prev.university,
            cgpa: r.extracted?.cgpa || prev.cgpa,
          }));
        }
        if (r.github?.profiles.length) api.profile().then(setProfile).catch(() => {});
        const m = ingestMsg(r);
        flash(m);
        return m;
      },
      resync: async (id) => { const r = await run("Re-reading the repo from GitHub", () => api.resync(id)); if (!r) return ""; await refreshLedger(); if (job) setJob(await api.latestJob()); const m = ingestMsg(r); flash(m); return m; },
      reupload: async (id, f) => { const r = await run("Re-reading the updated file", () => api.upload(f, id)); if (!r) return ""; await refreshLedger(); if (job) setJob(await api.latestJob()); const m = ingestMsg(r); flash(m); return m; },
      removeSource: async (id) => {
        if (!live) return;
        await run("Removing the source, its facts and its cache", async () => {
          await api.removeSource(id);
          await refreshLedger();
          if (job) setJob(await api.latestJob());
        });
        flash("Removed. Its facts and cached analysis were cleared, so uploading it again re-analyses it from scratch.");
      },
      found,
      clearFound: () => setFound({ profiles: [], repos: [] }),

      facts,
      setFactStatus: async (id, s) => {
        if (!live) return setFacts((fs) => fs.map((f) => (f.id === id ? { ...f, status: s } : f)));
        const f = await run("Saving", () => api.setFact(id, s));
        if (f) { setFacts((fs) => fs.map((x) => (x.id === id ? { ...x, ...f } : x))); if (job) setJob(await api.latestJob()); }
      },
      editFact: async (id, text) => {
        if (!live) return setFacts((fs) => fs.map((f) => (f.id === id ? { ...f, text, status: "verified" } : f)));
        const f = await run("Saving", () => api.editFact(id, text));
        if (f) { setFacts((fs) => fs.map((x) => (x.id === id ? { ...x, ...f } : x))); if (job) setJob(await api.latestJob()); }
      },
      deleteFact: async (id) => {
        if (!live) return setFacts((fs) => fs.filter((f) => f.id !== id));
        await run("Deleting claim", () => api.deleteFact(id));
        setFacts((fs) => fs.filter((f) => f.id !== id));
        if (job) setJob(await api.latestJob());
      },
      createFact: async (data) => {
        if (!live) {
          const fakeId = `F${Date.now()}`;
          setFacts((fs) => [...fs, { id: fakeId, ...data, span: data.span || "", status: data.status || "verified", sourceType: "note", source: "self-declared", category: data.category as any }]);
          return;
        }
        const created = await run("Adding claim", () => api.createFact(data));
        if (created) {
          await refreshLedger();
          if (job) setJob(await api.latestJob());
        }
      },
      verifyProject: async (project) => {
        if (!live) {
          setFacts((fs) => fs.map((f) => (f.project === project ? { ...f, status: "verified" } : f)));
          return;
        }
        await run(`Verifying ${project}`, () => api.verifyProject(project));
        await refreshLedger();
        if (job) setJob(await api.latestJob());
      },
      unverifyProject: async (project) => {
        if (!live) {
          setFacts((fs) => fs.map((f) => (f.project === project ? { ...f, status: "pending" } : f)));
          return;
        }
        await run(`Unverifying ${project}`, () => api.unverifyProject(project));
        await refreshLedger();
        if (job) setJob(await api.latestJob());
      },
      deleteProject: async (project) => {
        if (!live) {
          setFacts((fs) => fs.filter((f) => f.project !== project));
          return;
        }
        await run(`Deleting project ${project}`, () => api.deleteProject(project));
        await refreshLedger();
        if (job) setJob(await api.latestJob());
      },
      confirmGroup: async (project) => {
        if (!live) return setFacts((fs) => fs.map((f) => ((project === null || f.project === project) && f.status === "pending" ? { ...f, status: "verified" } : f)));
        const r = await run("Confirming", () => api.bulk(project, "verified", "pending"));
        if (r) { await refreshLedger(); if (job) setJob(await api.latestJob()); flash(`Confirmed ${r.updated} facts.`); }
      },
      rejectGroup: async (project) => {
        if (!live) return setFacts((fs) => fs.map((f) => (f.project === project && f.status !== "rejected" ? { ...f, status: "rejected" } : f)));
        const r = await run("Rejecting", () => api.bulk(project, "rejected", "all"));
        if (r) { await refreshLedger(); if (job) setJob(await api.latestJob()); flash(`Rejected ${r.updated} facts.`); }
      },
      declareSkill: async (skill) => {
        if (!live) return;
        await run("Saving", async () => { await api.declare(skill); await refreshLedger(); setJob(await api.latestJob()); });
        flash(`${skill} added as a self-declared skill (no source proof, lower score weight).`);
      },

      analyzed: isAnalyzed,
      jd,
      analyze: async (text) => {
        setJd(text);
        if (!live) { setDAnalyzed(true); return; }
        const j = await run("CrewAI flow: JD Analyzer then Matcher, then ADK Writer and Verifier", () => api.analyze(text));
        if (j) setJob(j);
      },
      meta: live && job ? job.meta : (isAnalyzed ? jobMeta : emptyMeta),
      requirements: live && job ? job.requirements : (isAnalyzed ? seedReqs : []),
      projects: live && job ? job.projects : (isAnalyzed ? dProjects : []),
      toggleProject: async (id) => {
        if (!live || !job) return setDProjects((ps) => ps.map((p) => (p.id === id ? { ...p, picked: !p.picked } : p)));
        const j = await run("Resume Writer + Verifier are rewriting the bullets for your new selection", () => api.toggleProject(job.id, id));
        if (j) setJob(j);
      },
      summary: live && job ? job.resume.summary : (isAnalyzed ? dSummary : ""),
      bullets: live && job ? job.resume.bullets : (isAnalyzed ? dBullets : []),
      skills: live && job ? job.resume.skills : [],
      setBullets: (b) => { if (!live) setDBullets(b); },
      editBullet: async (id, text) => {
        if (!live || !job) return setDBullets((bs) => bs.map((b) => (b.id === id ? { ...b, text } : b)));
        const j = await api.editBullet(job.id, id, text).catch((e) => { setError(String(e.message ?? e)); return null; });
        if (j) setJob(j);
      },
      addBullet: async (project, text, verified = true) => {
        if (!live || !job) {
          const fakeId = `U${Date.now()}`;
          setDBullets((bs) => [...bs, { id: fakeId, project, text, facts: [], verified, kind: "project", user: true }]);
          flash("Bullet added to resume!");
          return;
        }
        const j = await run("Adding suggested bullet to resume", () => api.addBullet(job.id, project, text, verified)).catch((e) => { setError(String(e.message ?? e)); return null; });
        if (j) { setJob(j); flash("Bullet added to resume!"); }
      },
      editSummary: async (text) => {
        if (!live || !job) return setDSummary(text);
        const j = await api.editSummary(job.id, text).catch(() => null);
        if (j) setJob(j);
      },
      undo: async () => {
        if (!live || !job) return;
        const j = await run("Undoing the last change", () => api.undo(job.id));
        if (j) { setJob(j); flash("Last change undone."); }
      },
      regenerate: async () => {
        if (!live || !job) return;
        const j = await run("ADK Resume Writer and Verifier loop", () => api.regenerate(job.id));
        if (j) setJob(j);
      },
      keywords: live && job ? job.keywords : (isAnalyzed ? dKeywords : []),
      decideKeyword: async (id, accept) => {
        if (!live || !job) {
          setDKeywords((ks) => ks.map((k) => (k.id === id ? { ...k, state: accept ? "accepted" : "rejected" } : k)));
          if (accept) {
            const k = dKeywords.find((x) => x.id === id);
            if (k?.rewrite && k.fact && !dBullets.some((b) => b.id === "K-" + id)) setDBullets([...dBullets, { id: "K-" + id, project: "SkillOra", text: k.rewrite, facts: [k.fact], verified: true }]);
          }
          return;
        }
        const j = await run("Saving", () => api.decideKeyword(job.id, id, accept));
        if (j) setJob(j);
      },
      chat: live && job ? job.chat : (isAnalyzed ? dChat : []),
      sendChat: async (m) => {
        if (!live || !job) {
          setDChat((c) => [...c, { from: "user", text: m }]);
          const lower = m.toLowerCase();
          if (/undo|revert/.test(lower)) {
            setDBullets((bs) => bs.filter((b) => !b.id.startsWith("chat-")));
            setTimeout(() => setDChat((c) => [...c, { from: "agent", text: "Undone. Previous resume state restored." }]), 500);
            return;
          }
          if (/senior|staff|lead/.test(lower) && /summary/.test(lower)) {
            setDSummary("Senior AI Engineer specializing in multi-agent orchestration (CrewAI, Google ADK), real-time FastAPI microservices, and deterministic fact verification architectures with sub-2.5s inference latency.");
            setTimeout(() => setDChat((c) => [...c, { from: "agent", text: "Updated your professional summary on the resume sheet to reflect Senior AI Engineer expertise." }]), 500);
            return;
          }
          if (/xyz|metric|quantif|strengthen/.test(lower)) {
            setDBullets((bs) => [...bs, {
              id: `chat-${Date.now()}`,
              project: "SkillOra",
              text: "Optimized multi-agent inference pipeline reducing end-to-end response latency by 35% (from 3.8s to 2.45s) while sustaining 100% fact extraction accuracy on production benchmarks.",
              facts: [],
              verified: true,
              kind: "project",
              user: true,
            }]);
            setTimeout(() => setDChat((c) => [...c, { from: "agent", text: "Strengthened bullets using Google's XYZ metric framework (-35% latency reduction, 100% precision). Reflected on your resume." }]), 500);
            return;
          }
          if (/fastapi|uvicorn|microservice/.test(lower)) {
            setDBullets((bs) => [...bs, {
              id: `chat-${Date.now()}`,
              project: "SkillOra",
              text: "Architected decoupled FastAPI microservices with Uvicorn and PostgreSQL connection pooling, maintaining sub-50ms latency across real-time WebSocket telemetry streams.",
              facts: [],
              verified: true,
              kind: "project",
              user: true,
            }]);
            setTimeout(() => setDChat((c) => [...c, { from: "agent", text: "Added high-impact microservices bullet highlighting FastAPI, Uvicorn, and PostgreSQL to SkillOra on your resume." }]), 500);
            return;
          }
          setTimeout(() => setDChat((c) => [...c, { from: "agent", text: "Done - updated and re-verified on your resume." }]), 500);
          return;
        }
        setJob({ ...job, chat: [...job.chat, { from: "user", text: m }] });
        const r = await run("ADK Coordinator is thinking", () => api.chat(job.id, m));
        if (r) {
          setJob(r.job);
          flash("Resume sheet updated via Google ADK Coordinator.");
        }
      },
      score: live ? (job ? job.score.total : 0) : demoScore,
      scoreProfile: live && job ? job.profile ?? null : null,
      profiles: live && job ? job.profiles ?? [] : [],
      setScoreProfile: async (id) => {
        if (!live || !job) return;
        const j = await run("Re-scoring with the new profile", () => api.setScoreProfile(job.id, id));
        if (j) setJob(j);
      },
      eligibility: live && job ? job.eligibility ?? null : null,
      components: live && job ? job.score.components : demoComps,
      recs: live && job ? job.recommendations : (isAnalyzed ? seedRecs : []),
      jobId: live && job ? job.id : null,
      mode: live && job ? job.mode : "demo",
    };
  }, [live, ready, busy, error, notice, llm, profile, router, found, sources, facts, job, jd, dBullets, dKeywords, dProjects, dChat, dAnalyzed, dSummary, run, refreshLedger]);

  void reloadJob;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
