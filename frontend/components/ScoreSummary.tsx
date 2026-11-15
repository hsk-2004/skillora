"use client";

import { useEffect, useRef, useState } from "react";
import ScoreRing from "./ScoreRing";
import type { ScoreComponent } from "@/lib/api";

// Compact live score for the Improve Resume page. The score comes from the scoring engine on the server and is recalculated
// after every change, so this card always shows the real current number and how much the last change moved it.
export default function ScoreSummary({ score, components, profileLabel }: { score: number; components: ScoreComponent[]; profileLabel?: string }) {
  const base = useRef<number | null>(null); // score when this page was first shown
  const prev = useRef<number | null>(null);
  const [delta, setDelta] = useState<{ n: number; at: number } | null>(null);

  useEffect(() => {
    if (score <= 0) return;
    if (base.current === null) base.current = score;
    if (prev.current !== null && prev.current !== score) setDelta({ n: score - prev.current, at: Date.now() });
    prev.current = score;
  }, [score]);

  const verdict = score === 0 ? "Waiting for a job analysis" : score >= 80 ? "Exceptional match" : score >= 60 ? "Competitive match" : "Needs targeted polish";
  const total = base.current !== null && score > 0 ? score - base.current : 0;

  return (
    <div className="bg-white border border-[#ECE7DD] rounded-2xl p-5 shadow-[0_2px_14px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <ScoreRing value={score} size={104} />
          <div className="space-y-1.5">
            <p className="text-sm font-serif font-bold text-[#141A16]">{verdict}</p>
            {profileLabel && <p className="text-[11px] text-[#78827A]">Profile: {profileLabel}</p>}
            <div className="flex flex-wrap gap-1.5">
              {delta && (
                <span
                  key={delta.at}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border animate-pulse ${
                    delta.n > 0 ? "bg-[#EAF4EB] text-[#1E6B38] border-[#C5E1CB]" : delta.n < 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-[#F3F4F6] text-[#556056] border-[#E5E7EB]"
                  }`}
                  title="Change from your last edit"
                >
                  {delta.n > 0 ? `▲ +${delta.n}` : delta.n < 0 ? `▼ ${delta.n}` : "No change"} last change
                </span>
              )}
              {total !== 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#556056] border border-[#ECE7DD]">
                  {total > 0 ? `+${total}` : total} since you opened this page
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 grid sm:grid-cols-2 xl:grid-cols-5 gap-3 min-w-0">
          {components.map((c) => (
            <div key={c.key} className="min-w-0 space-y-1" title={c.why}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-[#141A16] truncate">{c.key}</span>
                <span className="font-mono font-bold text-[#1E6B38] shrink-0">{c.scored === false ? "N/A" : Math.round(c.value)}</span>
              </div>
              <div className="w-full h-1.5 bg-[#E5E1D5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2E9B4E] to-[#1E6B38] rounded-full transition-all duration-700"
                  style={{ width: `${c.scored === false ? 0 : Math.min(c.value, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#78827A]">{c.weight}% weight</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
