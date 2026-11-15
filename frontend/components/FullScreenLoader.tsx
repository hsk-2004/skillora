"use client";

import { useEffect, useState } from "react";

// Dynamic full-screen loader. It is driven by what the app is actually doing: the message is the current action's own label, a timer
// shows how long it has been running, and the hint changes the longer the wait gets. It only appears after a short delay, so quick
// actions do not flash it. It stays until the refreshed data is in place, so the change is visible the moment it disappears.
export default function FullScreenLoader({
  message = "Working…",
  hint,
  actionLabel,
  onAction,
  delayMs = 250,
}: {
  message?: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(delayMs === 0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const show = delayMs === 0 ? null : setTimeout(() => setVisible(true), delayMs);
    const started = Date.now();
    const tick = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 500);
    return () => { if (show) clearTimeout(show); clearInterval(tick); };
  }, [delayMs]);

  if (!visible) return null;

  const stage = secs < 6 ? hint ?? "Please wait while this is saved." : secs < 20 ? "The AI model is working on this. It usually takes 10 to 40 seconds." : "Still working. Heavy steps, like writing a full resume, can take up to a minute.";

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-[#FAF9F5]/80 backdrop-blur-sm"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
    >
      <div className="w-[22rem] max-w-[90vw] flex flex-col items-center gap-4 rounded-2xl border border-[#DDD7CA] bg-white px-8 py-7 shadow-2xl">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-[#E5F0E7]" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1E6B38] animate-spin" />
          <div className="absolute inset-3 rounded-full bg-[#EAF4EB] animate-pulse" />
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-[#141A16] leading-snug">{message}</p>
          <p className="text-xs text-[#556056] leading-relaxed min-h-[2.5rem]">{stage}</p>
        </div>

        <div className="w-full h-1.5 rounded-full bg-[#E5E1D5] overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#2E9B4E] to-[#1E6B38] skl-indeterminate" />
        </div>

        <div className="w-full flex items-center justify-between text-[11px] text-[#78827A]">
          <span className="font-mono">{secs}s</span>
          {onAction && actionLabel && (
            <button type="button" onClick={onAction} className="font-semibold text-[#1E6B38] hover:underline cursor-pointer">
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
