"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useStore } from "@/lib/store";
import RequirementsModal from "@/components/RequirementsModal";
import AgentArchitectureModal from "@/components/AgentArchitectureModal";

type Live = {
  a2a?: { card?: { name?: string } | null; card_url?: string; calls?: number };
  tracing?: { enabled?: boolean; dashboard?: string };
  mcp?: { tools?: number };
  audit?: { total?: number; blocked?: number; guardrail?: number };
  deployment?: { platform?: string; public_url?: string; database?: string };
};
type Health = { crewai?: string; google_adk?: string; mcp_tools?: number };

type Card = {
  n: number;
  title: string;
  text: string;
  badge?: string;
  ok?: boolean;
  action: { label: string; href?: string; external?: boolean; onClick?: () => void };
};

export default function FacultyPage() {
  const st = useStore();
  const [live, setLive] = useState<Live | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [showReq, setShowReq] = useState(false);
  const [showArch, setShowArch] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/compliance`).then((r) => r.json()).then(setLive).catch(() => setLive(null));
    fetch(`${API}/api/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  const cards: Card[] = [
    { n: 1, title: "Context sharing", text: "Agents pass results through shared state.", badge: `${st.facts.length} facts in ledger`, ok: true,
      action: { label: "Open fact ledger", href: "/verify" } },
    { n: 2, title: "MCP tools", text: "Parser, database, GitHub and score tools.", badge: `${live?.mcp?.tools ?? health?.mcp_tools ?? 4} tools`, ok: true,
      action: { label: "View tools", href: `${API}/api/mcp/tools`, external: true } },
    { n: 3, title: "Structured output", text: "Every result follows a Pydantic schema.", badge: "Pydantic", ok: true,
      action: { label: "API schemas", href: `${API}/docs`, external: true } },
    { n: 4, title: "Agentic patterns", text: "Verifier loop, human review, router.", badge: "3 patterns", ok: true,
      action: { label: "See the flow", onClick: () => setShowArch(true) } },
    { n: 5, title: "Monitoring and callbacks", text: "Every step and error is logged.", badge: `${live?.audit?.total ?? 0} events`, ok: true,
      action: { label: "Live logs", href: "/logs" } },
    { n: 6, title: "A2A protocol", text: "CrewAI calls the Google ADK writer.", badge: live?.a2a?.card ? "Agent card live" : "Not reachable", ok: !!live?.a2a?.card,
      action: { label: "Agent card", href: live?.a2a?.card_url ?? "#", external: true } },
    { n: 7, title: "CrewAI + Google ADK", text: "Only these two frameworks are used.", badge: `CrewAI ${health?.crewai ?? ""} · ADK`, ok: !!health,
      action: { label: "See the agents", onClick: () => setShowArch(true) } },
    { n: 8, title: "Guardrails", text: "Blocks prompt injection and abusive input.", badge: `${live?.audit?.blocked ?? 0} blocked`, ok: true,
      action: { label: "Try it", onClick: () => setShowReq(true) } },
    { n: 9, title: "Tracing (Langfuse)", text: "Every agent run is traced.", badge: live?.tracing?.enabled ? "Connected" : "Not configured", ok: !!live?.tracing?.enabled,
      action: { label: "Open Langfuse", href: live?.tracing?.dashboard ?? "https://cloud.langfuse.com", external: true } },
    { n: 10, title: "Evaluation, cost and time", text: "Accuracy, latency and cost per resume.", badge: "Live run", ok: true,
      action: { label: "Run evaluation", onClick: () => setShowReq(true) } },
    { n: 11, title: "Cloud deployment", text: "Backend and frontend run online.", badge: live?.deployment ? `${live.deployment.platform} · ${live.deployment.database}` : "", ok: !!live,
      action: { label: "Open live site", href: live?.deployment?.public_url ?? "#", external: true } },
  ];

  const btn = "w-full py-2 rounded-xl text-xs font-bold border border-[#C5E1CB] bg-[#EAF4EB] hover:bg-[#D5EBD7] text-[#1E6B38] text-center cursor-pointer transition-all";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-3xl sm:text-4xl font-serif text-[#141A16] tracking-tight">System Overview</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={() => setShowReq(true)} className="px-4 py-2.5 rounded-full bg-[#EAF4EB] text-[#1E6B38] border border-[#C5E1CB] font-bold text-xs cursor-pointer">
            All 11 requirements
          </button>
          <Link href="/job" className="px-5 py-2.5 rounded-full bg-[#121614] text-white font-bold text-xs">← Back to Workspace</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.n} className="bg-white p-5 rounded-2xl border border-[#ECE7DD] flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#EAF4EB] text-[#1E6B38] font-bold text-xs flex items-center justify-center border border-[#C5E1CB]">{c.n}</span>
                {c.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${c.ok ? "text-[#1E6B38] bg-[#EAF4EB] border-[#C5E1CB]" : "text-[#B45309] bg-amber-50 border-amber-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {c.badge}
                  </span>
                )}
              </div>
              <h3 className="text-base font-serif font-bold text-[#141A16]">{c.title}</h3>
              <p className="text-xs text-[#556056]">{c.text}</p>
            </div>
            {c.action.onClick ? (
              <button type="button" onClick={c.action.onClick} className={btn}>{c.action.label}</button>
            ) : c.action.external ? (
              <a href={c.action.href} target="_blank" rel="noopener noreferrer" className={btn}>{c.action.label} ↗</a>
            ) : (
              <Link href={c.action.href ?? "#"} className={btn}>{c.action.label} →</Link>
            )}
          </div>
        ))}
      </div>

      {showReq && <RequirementsModal isOpen={showReq} onClose={() => setShowReq(false)} />}
      {showArch && <AgentArchitectureModal isOpen={showArch} onClose={() => setShowArch(false)} />}
    </div>
  );
}
