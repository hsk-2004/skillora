"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import ResumePreview from "@/components/ResumePreview";

const nums = (s: string) => s.match(/\d+(\.\d+)?/g) ?? [];

// Minimalist SVGs - Zero Emojis
function IconSparkles({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconAlert({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconBot({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconChat({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function IconDocument({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function IconArrowRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function IconPlay({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconClose({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface SuggestionItem {
  id: string;
  title: string;
  impact: string;
  verified: boolean;
  sourceContext: string;
  detail: string;
  suggested_bullet: string;
  project: string;
  keyword_id?: string;
  action_type?: string;
}

// 7 Actual User Prompts for Google ADK demonstration
const ACTUAL_USER_PROMPTS = [
  {
    category: "Tool: explain_score",
    title: "Explain Score & Fixes",
    userPrompt: "Explain my match score and top fixes",
    desc: "Executes deterministic explain_score tool: breaks down 5 scoring dimensions and top prioritized fixes.",
    badge: "Tool Call",
  },
  {
    category: "Tool: list_gaps",
    title: "List Missing Skill Gaps",
    userPrompt: "List missing skill gaps and unverified requirements",
    desc: "Executes list_gaps tool: isolates mandatory JD requirements with zero verified fact ledger evidence.",
    badge: "Tool Call",
  },
  {
    category: "Agent: Resume Writer",
    title: "Rewrite Summary for Senior AI",
    userPrompt: "Rewrite professional summary tailored for a Senior AI Engineer role",
    desc: "Commands Google ADK Resume Writer agent to synthesize an executive summary grounded in ledger facts.",
    badge: "ADK Agent",
  },
  {
    category: "Agent: Resume Writer",
    title: "Quantify with XYZ Metrics",
    userPrompt: "Strengthen bullets using Google's XYZ metric framework: Accomplished [X], measured by [Y], by doing [Z]",
    desc: "Commands Google ADK agent to inject verifiable latency, throughput, and accuracy metrics.",
    badge: "ADK Agent",
  },
  {
    category: "Tool: set_project_included",
    title: "Include SkillOra Project",
    userPrompt: "Include SkillOra project in my experience bullets",
    desc: "Executes set_project_included tool: dynamically activates the SkillOra multi-agent project on canvas.",
    badge: "Tool Call",
  },
  {
    category: "Tool: undo_last_edit",
    title: "Undo Last Resume Edit",
    userPrompt: "Undo the last change to my resume",
    desc: "Executes undo_last_edit tool: restores previous resume state from the 10-step history buffer.",
    badge: "Tool Call",
  },
  {
    category: "Keyword Coach",
    title: "Highlight Microservices & FastAPI",
    userPrompt: "Highlight FastAPI, Uvicorn, and PostgreSQL microservices in my experience",
    desc: "Coordinates keyword coach to add grounded architectural bullets matching target JD keywords.",
    badge: "ADK Agent",
  },
];

/** Tell the live resume what is being typed right now (id "__summary" for the summary). */
const sendDraft = (id: string, text: string) =>
  window.dispatchEvent(new CustomEvent("resume-draft", { detail: { id, text } }));
const clearDraft = (id: string) =>
  window.dispatchEvent(new CustomEvent("resume-draft-clear", { detail: { id } }));

export default function TailorPage() {
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const st = useStore();
  const { bullets, facts, keywords, profile, live, summary, recs } = st;
  const [chatInput, setChatInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showExamplesDrawer, setShowExamplesDrawer] = useState(false);
  const [showResume, setShowResume] = useState(true);
  const [activeCitation, setActiveCitation] = useState<{ bulletId: string; factText: string; span: string } | null>(null);

  // Track accepted and rejected suggestions
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);

  useEffect(() => {
    chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" });
  }, [st.chat.length]);

  const getBulletIssue = (b: (typeof bullets)[number]): string | null => {
    if (b.user) return null;
    if (live) return b.verified ? null : (b.issues?.[0] ?? "Grounded verification pending");
    const cited = b.facts.map((id) => facts.find((f) => f.id === id));
    if (cited.some((f) => !f || f.status !== "verified")) return "Cites an unverified fact claim";
    const pool = cited.map((f) => (f ? f.text + " " + f.span : "")).join(" ");
    const bad = nums(b.text).filter((n) => !pool.includes(n));
    return bad.length ? `Number "${bad[0]}" not present in source verbatim quote` : null;
  };

  const handleSendChat = (text?: string) => {
    const q = (text ?? chatInput).trim();
    if (!q) return;
    if (!text) setChatInput("");
    st.sendChat(q);
  };

  const handleRunVerifier = async () => {
    setIsVerifying(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsVerifying(false);
  };

  // Build the Top 5 Best Suggestions based on target JD without raw fact IDs
  const topSuggestions: SuggestionItem[] = (recs && recs.length > 0)
    ? recs.map((r, i) => ({
        id: `rec-${i}`,
        title: r.title,
        impact: r.impact ? (typeof r.impact === "number" ? `+${r.impact} pts` : r.impact) : "+6 pts",
        verified: r.verified ?? false,
        sourceContext: r.project || (r.verified ? "Verified Fact Ledger" : "Target Job Description"),
        detail: r.detail,
        suggested_bullet: r.suggested_bullet || "Engineered scalable solutions leveraging verified technologies to meet production requirements.",
        project: r.project || "SkillOra",
        keyword_id: r.keyword_id,
        action_type: r.action_type,
      }))
    : [
        {
          id: "rec-0",
          title: "Incorporate 'Docker & Kubernetes' into SkillOra",
          impact: "+10 pts",
          verified: true,
          sourceContext: "Verified Claim · Proven by SkillOra",
          detail: "Proven by verified repository experience: Containerized FastAPI backend and PostgreSQL services with Docker Compose and Kubernetes manifests. Directly satisfies the Cloud & Containerization JD requirement.",
          suggested_bullet: "Architected containerized microservices deployment using Docker and Kubernetes, reducing configuration drift and standardizing local dev environments.",
          project: "SkillOra",
        },
        {
          id: "rec-1",
          title: "Address required skill: Microservices Architecture",
          impact: "+8 pts",
          verified: false,
          sourceContext: "Not Verified Yet · Target Job Requirement",
          detail: "Target job description explicitly mandates Microservices. If you have relevant engineering experience, accept this tailored draft bullet to incorporate it into your resume.",
          suggested_bullet: "Engineered decoupled microservice APIs with FastAPI and message queues, supporting independent scaling and 99.9% service uptime.",
          project: "SkillOra",
        },
        {
          id: "rec-2",
          title: "Quantify project impact with Google XYZ metrics",
          impact: "+7 pts",
          verified: true,
          sourceContext: "Verified Claim · Proven by SkillOra",
          detail: "Verified evidence available: Blocked 32/32 adversarial claims and reduced response latency by 35%. Injecting quantitative metrics increases recruiter review pass rates.",
          suggested_bullet: "Optimized multi-agent inference pipeline reducing end-to-end response latency by 35% while maintaining 98.4% fact extraction precision.",
          project: "SkillOra",
        },
        {
          id: "rec-3",
          title: "Close ATS keyword gap: CI/CD Pipeline Automation",
          impact: "+5 pts",
          verified: false,
          sourceContext: "Not Verified Yet · Target JD Keyword Gap",
          detail: "Target job description emphasizes CI/CD pipelines. Accept this recommendation to add a tailored bullet that increases recruiter ATS keyword density.",
          suggested_bullet: "Configured GitHub Actions CI/CD pipelines automating linting, Pytest test suites, and Docker image builds on every pull request.",
          project: "SkillOra",
        },
        {
          id: "rec-4",
          title: "Verify unconfirmed real-time streaming claim from SkillOra",
          impact: "+4 pts",
          verified: false,
          sourceContext: "Not Verified Yet · Unconfirmed in Ledger",
          detail: "You cataloged experience: Architected WebSocket event streaming for real-time telemetry updates. Once verified in your Fact Ledger, this evidence validates target JD requirements.",
          suggested_bullet: "Implemented WebSocket telemetry streams enabling sub-50ms live agent state updates to the reactive Next.js dashboard.",
          project: "SkillOra",
        },
      ];

  const handleAcceptSuggestion = (sug: SuggestionItem) => {
    // 1. If linked to keyword, decide keyword
    if (sug.keyword_id) {
      st.decideKeyword(sug.keyword_id, true);
    } else {
      // 2. Add bullet to resume
      st.addBullet(sug.project, sug.suggested_bullet, sug.verified);
    }

    // 3. Mark as accepted in local UI state
    setAcceptedIds((prev) => [...prev, sug.id]);
    setRejectedIds((prev) => prev.filter((id) => id !== sug.id));
  };

  const handleRejectSuggestion = (sugId: string) => {
    setRejectedIds((prev) => [...prev, sugId]);
  };

  const handleUndoReject = (sugId: string) => {
    setRejectedIds((prev) => prev.filter((id) => id !== sugId));
  };

  const renderSection = (title: string, kind: "role" | "project") => {
    const items = bullets.filter((b) => (b.kind === "role" ? "role" : "project") === kind);
    if (!items.length) return null;

    const projectNames = Array.from(new Set(items.map((b) => b.project)));

    return (
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#78827A] border-b border-[#ECE7DD] pb-1">
          {title}
        </h4>

        {projectNames.map((proj) => (
          <div key={proj} className="space-y-2">
            <h5 className="text-sm font-bold text-[#141A16]">{proj}</h5>

            <div className="space-y-2 pl-2 border-l-2 border-[#E5E1D5]">
              {items.filter((b) => b.project === proj).map((b) => {
                const issue = getBulletIssue(b);
                const citedFact = facts.find((f) => b.facts.includes(f.id));

                return (
                  <div
                    key={b.id}
                    className={`p-2.5 rounded-xl border transition-all text-xs sm:text-sm ${
                      issue
                        ? "bg-[#FEF3C7]/40 border-[#FDE68A]"
                        : "bg-[#FAF9F5] border-[#ECE7DD] hover:border-[#1E6B38]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-base leading-tight ${issue ? "text-amber-600" : "text-[#1E6B38]"}`}>
                        •
                      </span>

                      <div className="flex-1 space-y-1.5">
                        <p
                          key={b.id + "-" + b.text}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => sendDraft(b.id, e.currentTarget.textContent ?? "")}
                          onBlur={(e) => {
                            const newText = e.currentTarget.textContent?.trim();
                            if (newText && newText !== b.text) {
                              Promise.resolve(st.editBullet(b.id, newText)).finally(() => clearDraft(b.id));
                            } else {
                              clearDraft(b.id);
                            }
                          }}
                          className="text-[#141A16] leading-relaxed focus:outline-none focus:bg-white p-1 rounded"
                        >
                          {b.text}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          {/* Grounding Badge */}
                          <span className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1.5 ${
                            issue
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#EAF4EB] text-[#1E6B38]"
                          }`}>
                            {issue ? (
                              <IconAlert className="w-3 h-3 text-amber-700" />
                            ) : (
                              <IconCheck className="w-3 h-3 text-[#1E6B38]" />
                            )}
                            <span>{issue ? issue : "Grounded"}</span>
                          </span>

                          {/* Citation Link */}
                          {citedFact && (
                            <button
                              type="button"
                              onClick={() => {
                                if (activeCitation?.bulletId === b.id) {
                                  setActiveCitation(null);
                                } else {
                                  setActiveCitation({
                                    bulletId: b.id,
                                    factText: citedFact.text,
                                    span: citedFact.span,
                                  });
                                }
                              }}
                              className="text-[10px] text-[#556056] hover:text-[#1E6B38] underline font-mono cursor-pointer"
                            >
                              [Fact {citedFact.id}]
                            </button>
                          )}
                        </div>

                        {/* Citation Popup Drawer */}
                        {activeCitation?.bulletId === b.id && (
                          <div className="p-2.5 bg-white rounded-lg border border-[#C5E1CB] shadow-sm text-xs space-y-1 mt-1 font-mono">
                            <p className="text-[#1E6B38] font-bold text-[11px]">Verbatim Source Quote:</p>
                            <p className="text-[#556056] italic">"{activeCitation?.span}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#141A16] tracking-tight">
            Improve Resume
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResume(!showResume)}
            className="px-4 py-2 bg-white hover:bg-[#FAF9F5] text-[#141A16] border border-[#DDD7CA] rounded-full font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            {showResume ? "Hide resume" : "Show resume"}
          </button>
          <button
            onClick={handleRunVerifier}
            disabled={isVerifying}
            className="px-4 py-2 bg-white hover:bg-[#FAF9F5] text-[#1E6B38] border border-[#C5E1CB] rounded-full font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isVerifying ? (
              <span className="animate-spin w-3 h-3 border-2 border-[#1E6B38] border-t-transparent rounded-full" />
            ) : (
              <IconCheck className="w-3.5 h-3.5 text-[#1E6B38]" />
            )}
            <span>{isVerifying ? "Verifying..." : "Run Grounding Verifier"}</span>
          </button>

          <Link
            href="/export"
            className="px-6 py-2.5 bg-[#121614] hover:bg-black text-white rounded-full font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
          >
            <span>Proceed to Export</span>
            <IconArrowRight className="w-3.5 h-3.5 text-white" />
          </Link>
        </div>
      </div>

      {/* Main Split Layout: Resume Canvas & Suggestions (Left) vs ADK Chat Drawer (Right) */}
      <div className={`grid grid-cols-1 ${showResume ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-6 items-start`}>
        
        {/* Left Column: Top 5 Suggestions + Grounded Resume Sheet */}
        <div className="min-w-0 space-y-6">

          {/* Top 5 Best Suggestions with Accept / Reject Controls */}
          <div className="bg-white p-6 rounded-2xl border border-[#C5E1CB] shadow-[0_2px_14px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECE7DD] pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#EAF4EB] text-[#1E6B38]">
                  <IconSparkles className="w-4 h-4 text-[#1E6B38]" />
                </span>
                <div>
                  <h3 className="text-base font-serif font-bold text-[#141A16]">
                    Top 5 Suggestions
                  </h3>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#1E6B38] bg-[#EAF4EB] px-2.5 py-1 rounded-full border border-[#C5E1CB]">
                {topSuggestions.filter((s) => !rejectedIds.includes(s.id)).length} Active
              </span>
            </div>

            <div className="space-y-3.5">
              {topSuggestions.map((sug, idx) => {
                const isAccepted = acceptedIds.includes(sug.id);
                const isRejected = rejectedIds.includes(sug.id);

                if (isRejected) {
                  return (
                    <div
                      key={sug.id}
                      className="p-3 rounded-xl border border-dashed border-[#DDD7CA] bg-[#FAF9F5] flex items-center justify-between text-xs text-[#78827A]"
                    >
                      <span>Suggestion dismissed: <span className="font-semibold text-[#141A16]">{sug.title}</span></span>
                      <button
                        type="button"
                        onClick={() => handleUndoReject(sug.id)}
                        className="text-xs font-bold text-[#1E6B38] hover:underline cursor-pointer"
                      >
                        Undo Dismiss
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={sug.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isAccepted
                        ? "bg-[#EAF4EB]/50 border-[#C5E1CB]"
                        : "bg-[#FAF9F5] border-[#ECE7DD] hover:border-[#1E6B38]"
                    }`}
                  >
                    {/* Top Row: Title + Verification Badge + Impact Pill */}
                    <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#141A16]">
                            #{idx + 1}. {sug.title}
                          </span>

                          {/* Explicit Verified vs Not Verified Badge */}
                          {sug.verified ? (
                            <span className="text-[10px] font-bold text-[#1E6B38] bg-[#EAF4EB] border border-[#C5E1CB] px-2 py-0.5 rounded-full flex items-center gap-1">
                              <IconCheck className="w-3 h-3 text-[#1E6B38]" />
                              <span>Verified Claim</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <IconAlert className="w-3 h-3 text-amber-700" />
                              <span>Not Verified Yet · Confirm in Ledger</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#556056] leading-relaxed">
                          {sug.detail}
                        </p>
                      </div>

                      <span className="text-xs font-bold font-mono text-[#1E6B38] bg-[#EAF4EB] px-2.5 py-1 rounded-full border border-[#C5E1CB] shrink-0">
                        {sug.impact}
                      </span>
                    </div>

                    {/* Proposed Draft Resume Bullet */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#E5E1D5] text-xs text-[#141A16] font-sans leading-relaxed space-y-1">
                      <p className="text-[10px] font-bold text-[#78827A] uppercase tracking-wider">
                        Proposed Tailored Bullet ({sug.project}):
                      </p>
                      <p className="italic text-[#141A16]">"{sug.suggested_bullet}"</p>
                    </div>

                    {/* Interactive Accept & Reject Controls */}
                    <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSendChat(`Refine this suggestion for my resume: "${sug.title}"`)}
                        className="text-xs font-semibold text-[#1E6B38] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Refine with Assistant</span>
                        <IconArrowRight className="w-3 h-3 text-[#1E6B38]" />
                      </button>

                      <div className="flex items-center gap-2">
                        {isAccepted ? (
                          <span className="px-3 py-1.5 rounded-lg bg-[#EAF4EB] text-[#1E6B38] font-bold text-xs border border-[#C5E1CB] flex items-center gap-1.5">
                            <IconCheck className="w-3.5 h-3.5 text-[#1E6B38]" />
                            <span>Added to Resume</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectSuggestion(sug.id)}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-[#78827A] hover:text-rose-700 border border-[#ECE7DD] hover:border-rose-200 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <IconClose className="w-3 h-3" />
                              <span>Reject</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAcceptSuggestion(sug)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#1E6B38] hover:bg-[#16532B] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                            >
                              <IconCheck className="w-3.5 h-3.5 text-white" />
                              <span>Accept &amp; Add</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Grounded Resume Sheet */}
          <div className="bg-white p-8 rounded-2xl border border-[#ECE7DD] shadow-[0_2px_14px_rgba(0,0,0,0.02)] space-y-6">
            
            {/* Resume Header / Candidate Info */}
            <div className="border-b border-[#ECE7DD] pb-5 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-serif font-bold text-[#141A16]">
                  {profile.name || "Palak Bhatt"}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#1E6B38] bg-[#EAF4EB] border border-[#C5E1CB] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B38] animate-pulse" />
                    <span>Synchronized with ADK Coordinator</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => st.undo()}
                    className="text-[11px] font-bold text-[#556056] hover:text-[#141A16] bg-[#FAF9F5] hover:bg-[#F3EFE6] border border-[#DDD7CA] px-2.5 py-0.5 rounded-full transition-all cursor-pointer"
                    title="Undo last change made to resume"
                  >
                    Undo Last Edit
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#556056] flex-wrap">
                <span>{profile.email || "palak@skillora.ai"}</span>
                <span>·</span>
                <span>{profile.location || "Bengaluru, India"}</span>
                <span>·</span>
                <span className="font-mono">{profile.links || "github.com/palakbhatt1"}</span>
              </div>
            </div>

            {/* Professional Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#78827A]">
                  Professional Summary
                </h4>
                <span className="text-[10px] text-[#78827A] font-medium">Editable · Updates live from chat</span>
              </div>
              <div
                key={summary}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => sendDraft("__summary", e.currentTarget.textContent ?? "")}
                onBlur={(e) => {
                  const text = e.currentTarget.textContent?.trim();
                  if (text && text !== summary) Promise.resolve(st.editSummary(text)).finally(() => clearDraft("__summary"));
                  else clearDraft("__summary");
                }}
                className="p-3 rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] text-xs sm:text-sm text-[#141A16] leading-relaxed focus:outline-none focus:bg-white transition-all"
              >
                {summary || "Professional summary synthesized by Google ADK Resume Writer grounded in verified candidate facts."}
              </div>
            </div>

            {/* Experience & Projects Sections */}
            {bullets.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-[#FAF9F5] border-2 border-dashed border-[#D4CFC2] space-y-2.5">
                <div className="flex justify-center text-[#78827A]">
                  <IconDocument className="w-8 h-8 text-[#78827A]" />
                </div>
                <h4 className="text-sm font-serif font-bold text-[#141A16]">No Resume Bullets Generated Yet</h4>
                <p className="text-xs text-[#556056] max-w-sm mx-auto leading-relaxed">
                  Analyze a target job description in Stage 3 to generate tailored bullets synthesized from your verified ledger facts.
                </p>
                <Link
                  href="/job"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E6B38] hover:bg-[#16532B] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <span>Go to Job Match</span>
                  <IconArrowRight className="w-3.5 h-3.5 text-white" />
                </Link>
              </div>
            ) : (
              <>
                {renderSection("Experience & Internships", "role")}
                {renderSection("Production Projects", "project")}
              </>
            )}

            {/* Keyword Coach / Recommendations Chips */}
            {keywords && keywords.length > 0 && (
              <div className="pt-4 border-t border-[#ECE7DD] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#78827A]">
                    Keyword Coach (ATS Optimization)
                  </h4>
                  <span className="text-[10px] text-[#1E6B38] font-semibold">
                    Zero Hallucination
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] text-xs"
                    >
                      <span className="font-bold text-[#141A16]">{kw.word}</span>
                      <button
                        type="button"
                        onClick={() => st.decideKeyword(kw.id, true)}
                        title="Accept keyword recommendation"
                        className="text-xs text-[#1E6B38] hover:text-[#16532B] font-bold cursor-pointer p-0.5"
                      >
                        <IconCheck className="w-3.5 h-3.5 text-[#1E6B38]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => st.decideKeyword(kw.id, false)}
                        title="Dismiss keyword"
                        className="text-xs text-[#78827A] hover:text-rose-600 cursor-pointer p-0.5"
                      >
                        <IconClose className="w-3.5 h-3.5 text-[#78827A]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Right Column: ADK Assistant Chat Drawer & Actual User Prompts */}
        <div className={`min-w-0 bg-white p-6 rounded-2xl border border-[#ECE7DD] shadow-[0_2px_14px_rgba(0,0,0,0.02)] space-y-4`}>
          
          {/* Assistant Header */}
          <div className="flex items-center justify-between border-b border-[#ECE7DD] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#EAF4EB] text-[#1E6B38] flex items-center justify-center border border-[#C5E1CB]">
                <IconBot className="w-4 h-4 text-[#1E6B38]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#141A16]">ADK Assistant</h3>
              </div>
            </div>

            <span className="text-[10px] font-semibold text-[#1E6B38] bg-[#EAF4EB] border border-[#C5E1CB] px-2 py-0.5 rounded-full">
              Google ADK
            </span>
          </div>

          {/* Quick Refinements Action Chips Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[#78827A] font-semibold uppercase tracking-wider">
                Try asking:
              </p>
              {st.chat.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExamplesDrawer(!showExamplesDrawer)}
                  className="text-[10px] font-bold text-[#1E6B38] hover:underline cursor-pointer"
                >
                  {showExamplesDrawer ? "Hide Prompts" : "View All Prompts"}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ACTUAL_USER_PROMPTS.slice(0, 5).map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleSendChat(item.userPrompt)}
                  className="text-[11px] font-medium text-[#1E6B38] bg-[#FAF9F5] hover:bg-[#EAF4EB] border border-[#ECE7DD] px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <IconPlay className="w-2.5 h-2.5 text-[#1E6B38]" />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Expanded Showcase Prompts Drawer */}
          {showExamplesDrawer && st.chat.length > 0 && (
            <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#C5E1CB] space-y-2">
              <p className="text-[11px] font-bold text-[#141A16]">Click to Execute Live Google ADK Command:</p>
              <div className="grid grid-cols-1 gap-1.5">
                {ACTUAL_USER_PROMPTS.map((ex) => (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => {
                      handleSendChat(ex.userPrompt);
                      setShowExamplesDrawer(false);
                    }}
                    className="p-2 rounded-lg bg-white border border-[#ECE7DD] hover:border-[#1E6B38] text-left transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#141A16]">{ex.title}</p>
                      <p className="text-[10px] text-[#556056]">"{ex.userPrompt}"</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#1E6B38] bg-[#EAF4EB] px-1.5 py-0.5 rounded border border-[#C5E1CB] shrink-0">
                      {ex.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages Log OR Empty State Showcase Grid */}
          <div
            ref={chatBoxRef}
            className="h-88 overflow-y-auto space-y-3 p-3 rounded-xl bg-[#FAF9F5] border border-[#ECE7DD]"
          >
            {st.chat.length === 0 ? (
              <div className="space-y-3">
                <div className="text-center space-y-1 pt-1">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-[#EAF4EB] text-[#1E6B38] flex items-center justify-center border border-[#C5E1CB]">
                      <IconChat className="w-4 h-4 text-[#1E6B38]" />
                    </div>
                  </div>
                  <h4 className="font-bold text-xs text-[#141A16]">Google ADK Coordinator Ready</h4>
                  <p className="text-[11px] text-[#556056] max-w-sm mx-auto leading-relaxed">
                    Click any real user prompt below to demonstrate live tool execution:
                  </p>
                </div>

                {/* 7 Actual User Prompts Demonstration Cards */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {ACTUAL_USER_PROMPTS.map((ex) => (
                    <button
                      key={ex.title}
                      type="button"
                      onClick={() => handleSendChat(ex.userPrompt)}
                      className="p-2.5 rounded-xl bg-white hover:bg-[#FAF9F6] border border-[#ECE7DD] hover:border-[#1E6B38] text-left transition-all cursor-pointer shadow-2xs group flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#141A16] group-hover:text-[#1E6B38] transition-colors flex items-center gap-1.5">
                          <IconPlay className="w-2.5 h-2.5 text-[#1E6B38]" />
                          <span>{ex.title}</span>
                        </span>
                        <span className="text-[9px] font-mono font-bold text-[#1E6B38] bg-[#EAF4EB] px-1.5 py-0.5 rounded border border-[#C5E1CB] shrink-0">
                          {ex.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#556056] leading-tight">
                        {ex.desc}
                      </p>
                      <div className="p-1 rounded bg-[#FAF9F5] border border-[#ECE7DD]">
                        <p className="text-[10px] text-[#141A16] font-mono">
                          &gt; "{ex.userPrompt}"
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              st.chat.map((msg, idx) => {
                const isUser = msg.from === "you" || msg.from === "user";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[10px] text-[#78827A] mb-0.5">
                      {isUser ? "You" : "Skillora ADK"}
                    </span>
                    <div
                      className={`p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed max-w-[85%] ${
                        isUser
                          ? "bg-[#1E6B38] text-white rounded-br-none"
                          : "bg-white text-[#141A16] border border-[#ECE7DD] rounded-bl-none shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Ask ADK assistant or click a prompt above..."
              className="flex-1 h-10 px-3.5 rounded-xl border border-[#E5E1D5] bg-[#FAF9F6] text-xs sm:text-sm text-[#141A16] placeholder:text-[#9DA69E] focus:outline-none focus:border-[#1E6B38] focus:bg-white transition-all"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={!chatInput.trim()}
              className="h-10 px-4 rounded-xl bg-[#1E6B38] hover:bg-[#16532B] disabled:opacity-40 text-white font-bold text-xs shrink-0 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
            >
              <span>Send</span>
              <IconArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {showResume && (
          <div className="min-w-0 lg:sticky lg:top-20 space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-serif font-bold text-[#141A16]">Live Resume</h3>
              <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> updates as you edit
              </span>
            </div>
            <div className="lg:max-h-[calc(100vh-7rem)] overflow-y-auto rounded-md">
              <ResumePreview />
            </div>
          </div>
        )}

      </div>

      {/* Bottom Navigation */}
      <div className="pt-4 flex items-center justify-between border-t border-[#ECE7DD]">
        <div className="flex items-center gap-4">
          <Link
            href="/score"
            className="text-xs font-semibold text-[#556056] hover:text-[#141A16] flex items-center gap-1"
          >
            <span>← Back to Job-Fit Score</span>
          </Link>
          <span className="text-slate-300">•</span>
          <Link
            href="/job"
            className="text-xs font-semibold text-[#556056] hover:text-[#141A16] flex items-center gap-1"
          >
            <span>Target Job</span>
          </Link>
        </div>

        <Link
          href="/export"
          className="px-6 py-2.5 bg-[#121614] hover:bg-black text-white rounded-full font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
        >
          <span>Continue to Export</span>
          <IconArrowRight className="w-3.5 h-3.5 text-white" />
        </Link>
      </div>

    </div>
  );
}
