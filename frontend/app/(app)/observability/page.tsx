"use client";

import Image from "next/image";
import SectionHeading from "@/components/SectionHeading";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Live = { tracing?: { enabled?: boolean; dashboard?: string } };

const card = "rounded-2xl border border-[#E5E1D5] bg-white p-5 shadow-2xs";
const muted = "text-sm text-[#556056] leading-relaxed";

const sections = [
  { id: "what", title: "What it is" },
  { id: "how", title: "How it works" },
  { id: "names", title: "Names you see" },
  { id: "run", title: "One real run" },
  { id: "screens", title: "The screens" },
  { id: "results", title: "Results" },
  { id: "a2a", title: "A2A hop" },
];

const why = [
  { t: "See every step", d: "Which agent did what, in order." },
  { t: "Know cost and speed", d: "Tokens, seconds and price for each call." },
  { t: "Prove it is grounded", d: "Trace any bullet back to the agent that wrote it." },
];

const flow = [
  { n: "1", who: "Our agents", what: "CrewAI and Google ADK run as normal." },
  { n: "2", who: "OpenTelemetry", what: "A listener records each step automatically." },
  { n: "3", who: "Langfuse", what: "Stores the records and shows them in a dashboard." },
];

const terms = [
  { t: "Trace", d: "One full run." },
  { t: "Span", d: "One step inside a run." },
  { t: "Token", d: "A small piece of text. Models charge per token." },
  { t: "Session", d: "Runs grouped together." },
];

const names = [
  { word: "invocation", means: "One complete run of an agent, from request to finish. The name in brackets says which agent.", part: "Google ADK" },
  { word: "invocation [skillora]", means: "The chat assistant answering a message.", part: "Chat coordinator" },
  { word: "invocation [resume_writer]", means: "The writer, called over A2A. Returns verified bullets.", part: "Writer + Verifier" },
  { word: "Flow_…", means: "A CrewAI script of steps. Reads the job description and matches it to facts.", part: "JD analysis" },
  { word: "Crew_…", means: "A CrewAI team of agents. This one is the planner that hands writing to the writer.", part: "Planner" },
  { word: "agent_run", means: "The agent doing its work inside a run.", part: "Coordinator" },
  { word: "call_llm", means: "One question to the AI model. Uses tokens and costs money.", part: "Any agent" },
  { word: "get_resume · set_bullet", means: "Tools the agent uses. Fast and free.", part: "Coordinator tools" },
];

const tree = [
  { depth: 0, name: "invocation [skillora]", note: "The whole request", time: "34.72s", cost: "$0.001", kind: "root" },
  { depth: 1, name: "agent_run [coordinator]", note: "The agent starts", time: "34.71s", cost: "", kind: "agent" },
  { depth: 2, name: "call_llm", note: "Model reads the message", time: "7.74s", cost: "$0.000309", kind: "llm" },
  { depth: 2, name: "get_resume", note: "Tool reads the resume", time: "0.34s", cost: "free", kind: "tool" },
  { depth: 2, name: "call_llm", note: "Model writes the new bullet", time: "24.47s", cost: "$0.000416", kind: "llm" },
  { depth: 2, name: "set_bullet", note: "Tool saves the bullet", time: "0.43s", cost: "free", kind: "tool" },
  { depth: 2, name: "call_llm", note: "Model writes the reply", time: "2.46s", cost: "$0.0004", kind: "llm" },
];

const kindStyle: Record<string, string> = {
  root: "bg-[#EAF4EB] text-[#1E6B38] border-[#C5E1CB]",
  agent: "bg-[#F3EEFB] text-[#6B3FA0] border-[#DCCDF1]",
  llm: "bg-[#FFF4E0] text-[#9A5B00] border-[#F2D9A8]",
  tool: "bg-[#EEF2F7] text-[#3B4A5E] border-[#D5DCE6]",
};

const results = [
  { big: "$0.001", label: "Cost", note: "One chat edit. All from the 3 model calls." },
  { big: "~4k", label: "Tokens", note: "Text the model read and wrote." },
  { big: "~35s", label: "Time", note: "Mostly waiting for the model. Tools take under 0.5s." },
  { big: "100%", label: "Recorded", note: "Every agent, model call and tool call." },
];

export default function ObservabilityPage() {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    fetch(`${API}/api/compliance`).then((r) => r.json()).then(setLive).catch(() => setLive(null));
  }, []);

  const on = !!live?.tracing?.enabled;
  const dash = live?.tracing?.dashboard ?? "https://cloud.langfuse.com";

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E6B38]">Observability · Requirement 9</p>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#141A16] tracking-tight mt-1">Tracing with Langfuse</h1>
            <p className={`${muted} mt-2 max-w-2xl`}>
              Langfuse is a flight recorder for our agents. It records what went in, what came out, how long it took and what it cost.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${on ? "bg-[#EAF4EB] text-[#1E6B38] border-[#C5E1CB]" : "bg-[#FFF4E0] text-[#9A5B00] border-[#F2D9A8]"}`}>
              {on ? "Connected" : "Not connected"}
            </span>
            <a href={dash} target="_blank" rel="noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#C5E1CB] bg-[#EAF4EB] hover:bg-[#D5EBD7] text-[#1E6B38] transition-all">
              Open Langfuse
            </a>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}
              className="text-xs font-semibold text-[#556056] hover:text-[#1E6B38] bg-white hover:bg-[#EAF4EB] border border-[#E5E1D5] hover:border-[#C5E1CB] px-3 py-1.5 rounded-full transition-all">
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
      </header>

      {/* 1 What */}
      <section className="space-y-4">
        <SectionHeading n={1} id="what" title="What it is" sub="Why we trace our agents." />
        <div className="grid gap-4 sm:grid-cols-3">
          {why.map((w) => (
            <div key={w.t} className={card}>
              <p className="text-sm font-bold text-[#141A16]">{w.t}</p>
              <p className={`${muted} mt-1`}>{w.d}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {terms.map((t) => (
            <span key={t.t} className="text-xs bg-[#FAF9F5] border border-[#ECE7DD] rounded-full px-3 py-1.5">
              <span className="font-bold text-[#1E6B38]">{t.t}</span> <span className="text-[#556056]">= {t.d}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 2 How */}
      <section className="space-y-4">
        <SectionHeading n={2} id="how" title="How it works" sub="No extra code inside each agent. It is switched on with two keys in the .env file." />
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
          {flow.map((s, i) => (
            <div key={s.n} className="contents">
              <div className={`${card} text-center`}>
                <span className="inline-flex w-6 h-6 rounded-full bg-[#EAF4EB] text-[#1E6B38] text-xs font-bold items-center justify-center">{s.n}</span>
                <p className="text-sm font-bold text-[#141A16] mt-2">{s.who}</p>
                <p className="text-xs text-[#556056] mt-1">{s.what}</p>
              </div>
              {i < flow.length - 1 && <span className="hidden md:flex items-center text-[#1E6B38] font-bold text-lg">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* 3 Names */}
      <section className="space-y-4">
        <SectionHeading n={3} id="names" title="Names you see" sub="The exact words on the Langfuse screen." />
        <div className={`${card} p-0 overflow-hidden`}>
          <div className="hidden sm:grid grid-cols-[210px_1fr_150px] gap-4 px-4 py-2.5 bg-[#FAF9F5] border-b border-[#ECE7DD] text-[11px] font-bold uppercase tracking-wider text-[#6B756E]">
            <span>You see</span><span>It means</span><span>Part</span>
          </div>
          {names.map((w) => (
            <div key={w.word} className="grid sm:grid-cols-[210px_1fr_150px] gap-1 sm:gap-4 px-4 py-3 border-b border-[#F0ECE2] last:border-b-0">
              <span className="text-xs font-mono font-bold text-[#1E6B38] break-words">{w.word}</span>
              <span className="text-sm text-[#141A16] leading-relaxed">{w.means}</span>
              <span className="text-xs text-[#6B756E]">{w.part}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 One real run */}
      <section className="space-y-4">
        <SectionHeading n={4} id="run" title="One real run" sub="The user typed: “Rewrite my top project bullet to emphasise Docker.” Each row is one step, in order." />
        <div className={`${card} p-0 overflow-hidden`}>
          {tree.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#F0ECE2] last:border-b-0" style={{ paddingLeft: 16 + r.depth * 24 }}>
              <span className={`text-[11px] font-mono font-bold px-2 py-1 rounded-md border shrink-0 ${kindStyle[r.kind]}`}>{r.name}</span>
              <span className="text-xs text-[#556056] flex-1">{r.note}</span>
              <span className="text-xs font-mono text-[#141A16] w-14 text-right shrink-0">{r.time}</span>
              <span className="text-xs font-mono text-[#6B756E] w-20 text-right shrink-0">{r.cost}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className={`px-2 py-1 rounded-md border ${kindStyle.llm}`}>Model call (costs money)</span>
          <span className={`px-2 py-1 rounded-md border ${kindStyle.tool}`}>Tool (free, fast)</span>
          <span className={`px-2 py-1 rounded-md border ${kindStyle.agent}`}>Agent</span>
        </div>
      </section>

      {/* 5 Screens */}
      <section className="space-y-6">
        <SectionHeading n={5} id="screens" title="The screens" sub="The two Langfuse views we use." />

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] items-start">
          <div className={`${card} p-2 overflow-hidden`}>
            <Image src="/langfuse-list.png" alt="Langfuse list of runs" width={1518} height={747} className="w-full h-auto rounded-xl" />
          </div>
          <div className={card}>
            <p className="text-sm font-bold text-[#1E6B38]">A. The list of runs</p>
            <ul className={`${muted} mt-2 space-y-2 list-disc pl-4`}>
              <li>Each row is one run.</li>
              <li>Input is what the agent got. Output is what it returned.</li>
              <li>Each resume job makes three rows: Flow, then Crew, then invocation [resume_writer].</li>
              <li>That is our pipeline: CrewAI, then A2A, then ADK.</li>
            </ul>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr] items-start">
          <div className={`${card} p-2 overflow-hidden`}>
            <Image src="/langfuse-trace.png" alt="Langfuse trace of one chat request" width={999} height={927} className="w-full h-auto rounded-xl" />
          </div>
          <div className={card}>
            <p className="text-sm font-bold text-[#1E6B38]">B. Inside one run</p>
            <ul className={`${muted} mt-2 space-y-2 list-disc pl-4`}>
              <li>Top line: 34.72s, $0.001, 4k tokens for the whole request.</li>
              <li>Left: every step in order, like a receipt.</li>
              <li>Pink steps are model calls and cost money.</li>
              <li>Orange steps are tools and are free.</li>
              <li>Right: the user message, the agent reply, and which user and chat it belongs to.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6 Results */}
      <section className="space-y-4">
        <SectionHeading n={6} id="results" title="Results" sub="From the run above." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((r) => (
            <div key={r.label} className={card}>
              <p className="text-3xl font-serif text-[#1E6B38]">{r.big}</p>
              <p className="text-sm font-bold text-[#141A16] mt-1">{r.label}</p>
              <p className="text-xs text-[#556056] mt-1 leading-relaxed">{r.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7 A2A */}
      <section className="space-y-4 pb-8">
        <SectionHeading n={7} id="a2a" title="The A2A hop" sub="How the planner and the writer show up together." />
        <div className={`${card} flex flex-col md:flex-row items-stretch gap-3`}>
          <div className="flex-1 rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] p-4 text-center">
            <p className="text-sm font-bold text-[#141A16]">Planner</p>
            <p className="text-xs text-[#556056] mt-1">CrewAI · Crew_…</p>
          </div>
          <span className="flex items-center justify-center text-xs font-bold text-[#1E6B38] px-2">A2A →</span>
          <div className="flex-1 rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] p-4 text-center">
            <p className="text-sm font-bold text-[#141A16]">Writer + Verifier</p>
            <p className="text-xs text-[#556056] mt-1">Google ADK · invocation [resume_writer]</p>
          </div>
        </div>
        <p className={muted}>
          They are two separate programs, so Langfuse records two traces. Both get the same session ID (like{" "}
          <span className="font-mono">ctx-dfb18bce</span>), so the Sessions tab shows them together with the combined tokens and cost.
        </p>
      </section>
    </div>
  );
}
