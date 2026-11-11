"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type AuditEvent } from "@/lib/api";

const KINDS: { key: string; label: string; color: string }[] = [
  { key: "api", label: "API call", color: "bg-blue-50 text-blue-800 border-blue-200" },
  { key: "agent", label: "Agent", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "a2a", label: "A2A", color: "bg-purple-50 text-purple-800 border-purple-200" },
  { key: "tool", label: "Tool", color: "bg-amber-50 text-amber-800 border-amber-200" },
  { key: "guardrail", label: "Guardrail", color: "bg-rose-50 text-rose-800 border-rose-200" },
  { key: "callback", label: "Callback", color: "bg-slate-50 text-slate-700 border-slate-200" },
  { key: "error", label: "Error", color: "bg-red-50 text-red-800 border-red-300" },
];
const chip = (k: string) => KINDS.find((x) => x.key === k) ?? KINDS[5];

export default function LogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [live, setLive] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!live) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api.audit();
        if (!stop) { setEvents(r.events); setErr(""); }
      } catch (e) {
        if (!stop) setErr("Cannot reach the backend.");
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(id); };
  }, [live]);

  const shown = useMemo(() => events.filter((e) => filter === "all" || e.kind === filter), [events, filter]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-serif text-[#141A16]">Live Logs</h1>
        <button
          onClick={() => setLive(!live)}
          className="px-4 py-2 rounded-full border border-[#DDD7CA] bg-white text-xs font-bold text-[#141A16] flex items-center gap-2 cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
          {live ? "Live · Pause" : "Paused · Resume"}
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[{ key: "all", label: "All" }, ...KINDS].map((k) => (
          <button
            key={k.key}
            onClick={() => setFilter(k.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer ${filter === k.key ? "bg-[#1E6B38] text-white border-[#1E6B38] font-bold" : "bg-white text-[#556056] border-[#DDD7CA]"}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {err && <p className="text-xs text-red-700">{err}</p>}

      <div className="bg-white border border-[#ECE7DD] rounded-2xl overflow-hidden">
        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#78827A]">No activity yet. Use the app and events appear here.</p>
        ) : (
          <ul className="divide-y divide-[#F0ECE2] text-xs">
            {shown.map((e) => (
              <li key={e.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className="w-16 shrink-0 text-[#78827A] font-mono">{new Date(e.at * 1000).toLocaleTimeString([], { hour12: false })}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full border font-bold text-[10px] ${chip(e.kind).color}`}>{chip(e.kind).label}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#141A16] break-words">{e.source}</p>
                  <p className="text-[#556056] break-words">{e.note}</p>
                  {e.api && <p className="text-[10px] text-[#78827A]">calls: {e.api}</p>}
                </div>
                <span className={`shrink-0 font-semibold ${e.status === "ok" ? "text-[#1E6B38]" : e.status === "blocked" ? "text-[#B45309]" : "text-[#B91C1C]"}`}>{e.status}</span>
                <span className="w-14 shrink-0 text-right text-[#78827A]">{e.ms ? `${e.ms} ms` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
