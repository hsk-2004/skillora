"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Activity, type ActivityStep } from "@/lib/api";

const secs = (ms: number) => (ms < 950 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`);

/** Shows, while an analysis runs, which agent is working, with which model, and through which API. */
export default function LiveRunPanel({ active }: { active: boolean }) {
  const [act, setAct] = useState<Activity | null>(null);
  const [, setTick] = useState(0);
  const fetchedAt = useRef(Date.now());
  const startedAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now() / 1000 - 2; // only show steps from this run
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      try {
        const a = await api.activity();
        if (stop) return;
        fetchedAt.current = Date.now();
        setAct(a);
      } catch { /* keep the last data */ }
      timer = setTimeout(loop, 500);
    };
    loop();
    const clock = setInterval(() => setTick((x) => x + 1), 200);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(clock);
      api.activity().then(setAct).catch(() => {}); // one last read so the finished steps stay visible
    };
  }, [active]);

  const running = act?.running ?? [];
  const finished = (act?.recent ?? []).filter((r) => r.at && r.at >= startedAt.current).slice(0, 8).reverse();
  if (!active && finished.length === 0) return null;

  const elapsed = (r: ActivityStep) => (r.elapsed_ms ?? 0) + (Date.now() - fetchedAt.current);
  const row = (r: ActivityStep, isRun: boolean) => (
    <li key={`${r.id}-${isRun ? "r" : "d"}`} className="px-4 py-2.5 flex items-start gap-3 text-xs">
      <span className="mt-1.5 shrink-0">
        {isRun ? <span className="block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> :
          <span className={`block w-2 h-2 rounded-full ${r.state === "error" ? "bg-red-500" : "bg-[#1E6B38]"}`} />}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-bold text-[#141A16]">{r.agent}</p>
        <p className="text-[#556056]">{r.tech}</p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <span className="px-2 py-0.5 rounded-full bg-[#F3EFE6] border border-[#E8E3D7] text-[10px]">
            <b>API:</b> {r.api || "None (plain Python)"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#F3EFE6] border border-[#E8E3D7] text-[10px]">
            <b>Model:</b> {r.model || "none"}
          </span>
        </div>
        {r.note && !isRun && <p className="text-[11px] text-[#78827A]">{r.note}</p>}
      </div>
      <span className={`shrink-0 font-semibold ${isRun ? "text-emerald-700" : "text-[#78827A]"}`}>
        {isRun ? `${secs(elapsed(r))}…` : r.ms ? secs(r.ms) : "cached"}
      </span>
    </li>
  );

  return (
    <div className="max-w-3xl mx-auto mt-5 bg-white border border-[#ECE7DD] rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 bg-[#FAF9F5] border-b border-[#ECE7DD] flex items-center justify-between">
        <span className="text-xs font-bold text-[#141A16]">Live agent activity</span>
        <span className={`text-[11px] font-semibold ${active ? "text-emerald-700" : "text-[#78827A]"}`}>{active ? "● Running" : "Finished"}</span>
      </div>
      <ul className="divide-y divide-[#F0ECE2]">
        {finished.map((r) => row(r, false))}
        {running.map((r) => row(r, true))}
        {active && running.length === 0 && finished.length === 0 && (
          <li className="px-4 py-3 text-xs text-[#78827A]">Starting agents…</li>
        )}
      </ul>
    </div>
  );
}
