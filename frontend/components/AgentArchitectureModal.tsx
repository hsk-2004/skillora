"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

const STEPS = [
  { title: "Check the input", who: "Python guardrails",
    plain: "Every uploaded file and typed message is scanned first. Attacks like “ignore your instructions”, abusive text, and files that are not resumes (for example lecture slides) are rejected.",
    tech: "Pattern checks + document classifier → HTTP 422" },
  { title: "Extract facts", who: "CrewAI · Source Extractor",
    plain: "An agent reads the resume or GitHub repo and writes down short facts. Each fact keeps the exact sentence it came from, so it can be proven later.",
    tech: "Pydantic output · a span check drops any fact whose quote is not in the source" },
  { title: "Review the facts", who: "You (human-in-the-loop)",
    plain: "You approve or reject each fact. Only approved facts are allowed into the resume.",
    tech: "Postgres fact ledger · verified / pending status · character offsets" },
  { title: "Understand the job", who: "CrewAI · JD Analyzer + Matcher",
    plain: "The job description is split into must-have and nice-to-have requirements. Each one is matched to your facts as met, partial or missing.",
    tech: "Matching cascade: exact → fuzzy (RapidFuzz) → embedding similarity" },
  { title: "Write the resume", who: "CrewAI Planner → A2A → Google ADK Writer",
    plain: "A CrewAI planner hands the writing job to a separate Google ADK agent over the A2A protocol. The writer may only use approved facts.",
    tech: "A2A message/send · agent card · ADK LlmAgent · shared context in the message" },
  { title: "Verify every line", who: "Google ADK · Verifier callback",
    plain: "A checker compares each bullet with its source fact. A bullet with a wrong number or a tool you never used is sent back for one rewrite.",
    tech: "after_model_callback · evaluator-optimizer loop" },
  { title: "Score and export", who: "Python math engine",
    plain: "The job-fit score is plain arithmetic over five weighted parts, so the same input always gives the same score. The resume exports as PDF or DOCX.",
    tech: "Deterministic scoring · fpdf2 · python-docx" },
];

const AGENTS = [
  { name: "Source Extractor", llm: "llm" as const, fw: "CrewAI", does: "Turns a resume or repo into facts with quotes.", tech: "Task with Pydantic output" },
  { name: "JD Analyzer", llm: "llm" as const, fw: "CrewAI", does: "Splits a job description into requirements.", tech: "Structured JSON output" },
  { name: "Matcher", llm: "partial" as const, fw: "CrewAI + Python", does: "Links each requirement to your facts.", tech: "Exact, fuzzy and embedding match" },
  { name: "Tailoring Planner", llm: "llm" as const, fw: "CrewAI", does: "Delegates the writing to the ADK agent.", tech: "A2A client tool" },
  { name: "Resume Writer", llm: "llm" as const, fw: "Google ADK", does: "Writes bullets and a summary from approved facts.", tech: "A2A server · LlmAgent" },
  { name: "Verifier", llm: "none" as const, fw: "Google ADK", does: "Checks every bullet against its source.", tech: "after_model_callback" },
  { name: "Coordinator", llm: "llm" as const, fw: "Google ADK", does: "Handles the chat: edits bullets, explains scores.", tech: "Tools + sub-agent" },
  { name: "Guardrails", llm: "none" as const, fw: "Python", does: "Blocks attacks, toxic text, bad files and bad tool output.", tech: "Input, prompt, tool and output layers" },
  { name: "Scoring Engine", llm: "none" as const, fw: "Python", does: "Calculates the job-fit score.", tech: "Deterministic, no LLM" },
  { name: "MCP Tool Server", llm: "none" as const, fw: "FastMCP", does: "Gives agents 4 tools: parser, ledger, GitHub, score.", tech: "Model Context Protocol" },
];

const ALWAYS = ["Guardrails", "Callbacks and live logs", "Langfuse tracing", "MCP tools"];

const FW_COLOR: Record<string, string> = {
  CrewAI: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "CrewAI + Python": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Google ADK": "bg-blue-50 text-blue-800 border-blue-200",
  Python: "bg-slate-50 text-slate-700 border-slate-200",
  FastMCP: "bg-indigo-50 text-indigo-800 border-indigo-200",
};

export default function AgentArchitectureModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"flow" | "agents">("flow");
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API}/api/health`).then((r) => r.json()).then((h) => setModels(h.models ?? [])).catch(() => setModels([]));
  }, [isOpen]);

  if (!isOpen) return null;
  const main = models[0] ?? "Gemini";

  const tabBtn = (k: "flow" | "agents", label: string) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 rounded-full text-xs font-bold border cursor-pointer ${tab === k ? "bg-[#1E6B38] text-white border-[#1E6B38]" : "bg-white text-[#556056] border-[#DDD7CA]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#FAF9F5] border border-[#DDD7CA] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-[#141A16]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 bg-white border-b border-[#E8E3D7] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-serif font-bold">How SkillOra works</h2>
            <p className="text-xs text-[#556056] mt-0.5">Two frameworks, CrewAI and Google ADK, connected by the A2A protocol.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3EFE6] hover:bg-[#E8E2D5] text-[#556056] font-bold text-sm cursor-pointer">✕</button>
        </div>

        <div className="px-6 py-3 flex gap-2 border-b border-[#ECE7DD] bg-white">
          {tabBtn("flow", "Flow")}
          {tabBtn("agents", "Agents")}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "flow" ? (
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <div key={s.title}>
                  <div className="bg-white border border-[#E8E3D7] rounded-xl p-4 flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-[#1E6B38] text-white font-bold text-sm flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-serif font-bold">{s.title}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF4EB] text-[#1E6B38] border border-[#C5E1CB]">{s.who}</span>
                      </div>
                      <p className="text-sm text-[#3D473F]">{s.plain}</p>
                      <p className="text-[11px] text-[#78827A] font-mono">{s.tech}</p>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && <div className="text-center text-[#1E6B38] leading-none py-1">↓</div>}
                </div>
              ))}
              <div className="mt-4 p-3 rounded-xl bg-[#F3EFE6] border border-[#E8E3D7] text-xs flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#556056]">Runs through every step:</span>
                {ALWAYS.map((a) => <span key={a} className="px-2 py-0.5 rounded-full bg-white border border-[#DDD7CA] text-[#141A16] font-semibold">{a}</span>)}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#556056]">
                LLM agents call Google&apos;s Gemini API. Primary model: <b>{main}</b>
                {models.length > 1 && <> · if it is busy they fall back to {models.slice(1).join(", ")}</>}.
              </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENTS.map((a) => (
                <div key={a.name} className="bg-white border border-[#E8E3D7] rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-serif font-bold">{a.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${FW_COLOR[a.fw] ?? FW_COLOR.Python}`}>{a.fw}</span>
                  </div>
                  <p className="text-xs text-[#3D473F]">{a.does}</p>
                  <p className="text-[11px] text-[#78827A] font-mono">{a.tech}</p>
                  <p className="text-[11px] font-semibold pt-1">
                    <span className="text-[#556056]">Model: </span>
                    {a.llm === "llm" && <span className="text-[#1E6B38]">{main}</span>}
                    {a.llm === "partial" && <span className="text-[#1E6B38]">{main} <span className="text-[#78827A] font-normal">(only for unclear matches)</span></span>}
                    {a.llm === "none" && <span className="text-[#78827A] font-normal">none, plain Python</span>}
                  </p>
                </div>
              ))}
            </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-[#E8E3D7] bg-white flex items-center justify-between">
          <Link href="/faculty" onClick={onClose} className="text-xs font-bold text-[#1E6B38] hover:underline">Open System Overview →</Link>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-[#1E6B38] hover:bg-[#16532B] text-white font-bold text-xs cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
}
