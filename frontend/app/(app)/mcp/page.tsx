"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import SectionHeading from "@/components/SectionHeading";

type Tool = {
  name: string;
  title: string;
  does: string;
  why: string;
  inputs: string[];
  used_by: { agent: string; when: string }[];
  calls: number;
};
type Registry = { status: string; endpoint: string; secured: boolean | string; total_calls: number; tools: Tool[] };
type Ping = { ok: boolean; tool?: string; ms?: number; endpoint?: string; result?: unknown; error?: string };

const card = "rounded-2xl border border-[#E5E1D5] bg-white p-5 shadow-2xs";
const muted = "text-sm text-[#556056] leading-relaxed";

const sections = [
  { id: "what", title: "What it is" },
  { id: "why", title: "Why we use it" },
  { id: "how", title: "How it works here" },
  { id: "tools", title: "The 4 tools" },
  { id: "try", title: "Try it live" },
  { id: "safe", title: "Safety" },
  { id: "not", title: "What does not use MCP" },
];

const codePath: Record<string, string> = {
  file_parser_mcp: "backend/app/mcp_server.py · called from api/sources.py (upload)",
  github_crawler_mcp: "backend/app/mcp_server.py · called from api/sources.py (GitHub)",
  ledger_db_lookup_mcp: "backend/app/mcp_server.py · used in agents/adk_agents.py (_mcp_toolset)",
  ats_calculator_mcp: "backend/app/mcp_server.py · used in agents/adk_agents.py (_mcp_toolset)",
};

export default function McpPage() {
  const [reg, setReg] = useState<Registry | null>(null);
  const [err, setErr] = useState("");
  const [ping, setPing] = useState<Ping | null>(null);
  const [pinging, setPinging] = useState(false);

  const load = () =>
    fetch(`${API}/api/mcp/tools`).then((r) => r.json()).then((j) => { setReg(j); setErr(""); }).catch(() => setErr("Cannot reach the backend."));

  useEffect(() => {
    load();
  }, []);

  const tryIt = async () => {
    setPinging(true);
    try {
      const r = await fetch(`${API}/api/mcp/ping`, { method: "POST" });
      setPing(await r.json());
      load();
    } catch {
      setPing({ ok: false, error: "Backend not reachable, so no MCP call was made." });
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E6B38]">Agent–tool communication · Requirement 2</p>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#141A16] tracking-tight mt-1">MCP: how our agents use tools</h1>
            <p className={`${muted} mt-2 max-w-2xl`}>
              MCP (Model Context Protocol) is a standard way for an agent to find and use tools. Our four tools sit behind one MCP server, and our agents call them through the protocol.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${reg?.status === "active" ? "bg-[#EAF4EB] text-[#1E6B38] border-[#C5E1CB]" : "bg-[#FFF4E0] text-[#9A5B00] border-[#F2D9A8]"}`}>
              {reg ? (reg.status === "active" ? "MCP server active" : "MCP disabled") : "Checking…"}
            </span>
            {reg && <span className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#E5E1D5] bg-white text-[#556056]">{reg.total_calls} tool calls so far</span>}
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
        {err && <p className="text-xs text-red-700">{err}</p>}
      </header>

      {/* 1 What */}
      <section className="space-y-4">
        <SectionHeading n={1} id="what" title="What it is" sub="A common plug for tools." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={card}>
            <p className="text-sm font-bold text-[#141A16]">MCP: agent ↔ tool</p>
            <p className={`${muted} mt-1`}>An MCP server lists the tools it offers. Any agent that speaks MCP can discover them, call them with the right inputs, and read the answer. Think of a USB socket: any device that fits can plug in.</p>
          </div>
          <div className={card}>
            <p className="text-sm font-bold text-[#141A16]">A2A: agent ↔ agent</p>
            <p className={`${muted} mt-1`}>Not the same thing. A2A connects one agent to another agent (our CrewAI planner and the ADK writer). MCP connects an agent to a <span className="font-semibold">tool</span>.</p>
          </div>
        </div>
      </section>

      {/* 2 Why */}
      <section className="space-y-4">
        <SectionHeading n={2} id="why" title="Why we use it" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "One set of tools for every agent", d: "The parser, the ledger lookup and the calculator are written once. Any agent can use them without copying code." },
            { t: "Agents stay simple and safe", d: "The agent never holds GitHub code or database access. The tool does the work and returns plain data." },
            { t: "Every use is logged", d: "Each tool call is recorded with its time and result, so you can see exactly what an agent did." },
          ].map((x) => (
            <div key={x.t} className={card}>
              <p className="text-sm font-bold text-[#1E6B38]">{x.t}</p>
              <p className={`${muted} mt-1`}>{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 How */}
      <section className="space-y-4">
        <SectionHeading n={3} id="how" title="How it works here" sub="Two ways in, one server, real code behind it." />
        <div className={`${card} space-y-4`}>
          <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch">
            <div className="space-y-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-sm font-bold text-blue-800">Coordinator</p>
                <p className="text-[11px] text-blue-700">Google ADK agent in the chat</p>
                <p className="text-[10px] text-blue-700 font-mono mt-1">McpToolset: the model picks the tool</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <p className="text-sm font-bold text-emerald-800">Upload and GitHub steps</p>
                <p className="text-[11px] text-emerald-700">The CrewAI source-reading flow</p>
                <p className="text-[10px] text-emerald-700 font-mono mt-1">mcp_client.py: our code calls the tool</p>
              </div>
            </div>
            <span className="hidden md:flex items-center text-[#1E6B38] font-bold text-lg">→</span>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center flex flex-col justify-center">
              <p className="text-sm font-bold text-amber-800">MCP protocol</p>
              <p className="text-[11px] text-amber-700">streamable HTTP · {reg?.endpoint ?? "/mcp/"}</p>
              <p className="text-[10px] text-amber-700 mt-1">key + user id on every call</p>
            </div>
            <span className="hidden md:flex items-center text-[#1E6B38] font-bold text-lg">→</span>
            <div className="rounded-xl border border-[#E5E1D5] bg-[#FAF9F5] p-3 flex flex-col justify-center">
              <p className="text-sm font-bold text-[#141A16] text-center">MCP tool server</p>
              <ul className="text-[11px] text-[#556056] mt-1 space-y-0.5 font-mono">
                <li>file_parser_mcp</li>
                <li>github_crawler_mcp</li>
                <li>ledger_db_lookup_mcp</li>
                <li>ats_calculator_mcp</li>
              </ul>
            </div>
          </div>
          <p className={muted}>
            The server runs inside the same backend, mounted at <span className="font-mono text-xs">/mcp/</span>. Each tool runs the project&apos;s real code: the real parser, the real GitHub reader, the real fact ledger and the real scoring weights.
          </p>
        </div>
      </section>

      {/* 4 Tools */}
      <section className="space-y-4">
        <SectionHeading n={4} id="tools" title="The 4 tools" sub="What each one does, who uses it, and why." />
        <div className="space-y-3">
          {(reg?.tools ?? []).map((t) => (
            <div key={t.name} className={card}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-[#141A16]">{t.title}</p>
                  <p className="text-xs font-mono font-bold text-[#1E6B38]">{t.name}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full border border-[#C5E1CB] bg-[#EAF4EB] text-[#1E6B38]">{t.calls} calls</span>
              </div>
              <p className={`${muted} mt-2`}>{t.does}</p>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div className="rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B756E]">Used by</p>
                  {t.used_by.map((u) => (
                    <p key={u.agent} className="text-xs text-[#141A16] mt-1"><span className="font-semibold">{u.agent}</span>, {u.when}</p>
                  ))}
                </div>
                <div className="rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B756E]">Why it is a tool</p>
                  <p className="text-xs text-[#141A16] mt-1">{t.why}</p>
                </div>
              </div>
              <p className="text-[11px] text-[#78827A] mt-3 font-mono">Inputs: {t.inputs.join(", ")}</p>
              <p className="text-[11px] text-[#78827A] font-mono">{codePath[t.name]}</p>
            </div>
          ))}
          {!reg && !err && <p className={muted}>Loading the tool list…</p>}
        </div>
      </section>

      {/* 5 Try */}
      <section className="space-y-4">
        <SectionHeading n={5} id="try" title="Try it live" sub="A real tool call over the MCP protocol, not just a list of names." />
        <div className={`${card} space-y-3`}>
          <button
            type="button"
            onClick={tryIt}
            disabled={pinging}
            className="px-5 py-2.5 rounded-full bg-[#1E6B38] hover:bg-[#16532B] text-white font-bold text-xs cursor-pointer disabled:opacity-60"
          >
            {pinging ? "Calling the tool…" : "Call ats_calculator_mcp"}
          </button>
          <p className="text-[11px] text-[#78827A]">Sends: skills 85, responsibility 80, evidence 87, education 100 (the worked example on the Score pages).</p>
          {ping && (
            <div className={`rounded-xl border p-4 ${ping.ok ? "border-[#C5E1CB] bg-[#EAF4EB]" : "border-rose-200 bg-rose-50"}`}>
              <p className={`text-sm font-bold ${ping.ok ? "text-[#1E6B38]" : "text-rose-700"}`}>
                {ping.ok ? `Answered in ${ping.ms} ms through the MCP protocol` : "The MCP call failed"}
              </p>
              <pre className="mt-2 text-[11px] font-mono text-[#141A16] whitespace-pre-wrap max-h-60 overflow-y-auto">{JSON.stringify(ping.ok ? ping.result : ping.error, null, 2)}</pre>
            </div>
          )}
          <p className={muted}>To see real agent calls: ask the chat on the Improve Resume page something like &quot;look up my verified facts&quot;, then open Live Logs and choose the <span className="font-semibold">MCP</span> filter.</p>
        </div>
      </section>

      {/* 6 Safety */}
      <section className="space-y-4">
        <SectionHeading n={6} id="safe" title="Safety" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { t: "A key or the same machine", d: "Every call needs the shared key. If no key is set, only calls from this machine are accepted." },
            { t: "The user comes from our code", d: "The user id is added to each call by the backend, never written by the model. A tricked agent cannot read someone else's facts." },
            { t: "Only two tools for the chat model", d: "The Coordinator may use the ledger lookup and the calculator. Both only read data. It cannot call the parser or the GitHub reader." },
            { t: "A safe fallback", d: "If the MCP server cannot be reached, uploads and GitHub reads run the same code directly, and the problem is logged. Nothing breaks." },
          ].map((x) => (
            <div key={x.t} className={card}>
              <p className="text-sm font-bold text-[#1E6B38]">{x.t}</p>
              <p className={`${muted} mt-1`}>{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7 Not */}
      <section className="space-y-4 pb-8">
        <SectionHeading n={7} id="not" title="What does not use MCP" sub="So the picture stays honest." />
        <div className={card}>
          <ul className={`${muted} space-y-1.5 list-disc pl-4`}>
            <li>The Coordinator&apos;s resume-editing tools (<span className="font-mono text-xs">get_resume</span>, <span className="font-mono text-xs">set_bullet</span>, <span className="font-mono text-xs">add_bullet</span> and so on) are ordinary Python functions. They change your resume directly.</li>
            <li>The matcher, the verifier and the scoring engine run as plain code inside the pipeline.</li>
            <li>The planner-to-writer hand-off uses A2A, not MCP.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
