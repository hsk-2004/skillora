"use client";

import Link from "next/link";
import { useEffect } from "react";
import LiveLogsView from "./LiveLogsView";

// Popup version of the Live Logs. Opens on top of any page, so a running task is never interrupted by navigating away.
export default function LiveLogsModal({ onClose, busy }: { onClose: () => void; busy?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Live logs"
    >
      <div
        className="bg-[#FAF9F5] border border-[#DDD7CA] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#ECE7DD]">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl font-serif text-[#141A16]">Live Logs</h2>
            {busy ? (
              <span className="text-xs font-semibold text-[#1E6B38] bg-[#EAF4EB] border border-[#C5E1CB] rounded-full px-3 py-1 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Running: {busy}</span>
              </span>
            ) : (
              <span className="text-xs text-[#78827A]">No task running</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/logs" onClick={onClose} className="text-xs font-semibold text-[#556056] hover:text-[#1E6B38] px-3 py-1.5 rounded-full border border-[#DDD7CA] bg-white">
              Open full page
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close live logs"
              className="w-8 h-8 rounded-full border border-[#DDD7CA] bg-white text-[#556056] hover:text-rose-700 flex items-center justify-center cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto">
          <LiveLogsView />
        </div>
      </div>
    </div>
  );
}
