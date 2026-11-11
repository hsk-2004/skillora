"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import Ambient from "./Ambient";
import AgentArchitectureModal from "./AgentArchitectureModal";

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { busy, error, notice, mode, profile, logout } = useStore();
  const [showAgentModal, setShowAgentModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#141A16] flex flex-col relative selection:bg-[#DCFCE7] selection:text-[#166534]">
      <Ambient />

      {/* Main App Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-[#ECE7DD] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <Link href="/job" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 transition-transform group-hover:rotate-12 duration-300">
              <Image 
                src="/logo.png" 
                alt="Skillora Logo" 
                width={32} 
                height={32} 
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl font-serif font-bold tracking-tight text-[#141A16]">
              Skillora
            </span>
          </Link>

          {/* Right Header: Agent Architecture button + System Architecture link + Profile Icon Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowAgentModal(true)}
              className="text-xs font-semibold text-[#1E6B38] bg-[#EAF4EB] hover:bg-[#D5EBD7] px-3 py-1.5 rounded-full border border-[#C5E1CB] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Inspect multi-agent architecture and active agents"
            >
              <svg className="w-3.5 h-3.5 text-[#1E6B38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM9 20a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM7 10v4a2 2 0 002 2h6a2 2 0 002-2v-4" />
              </svg>
              <span>Agent Architecture</span>
            </button>

            <Link
              href="/logs"
              className="text-xs font-semibold text-[#556056] hover:text-[#1E6B38] px-3 py-1.5 rounded-full hover:bg-white border border-transparent hover:border-[#E5E1D5] transition-all hidden md:flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Logs</span>
            </Link>

            <Link
              href="/faculty"
              className="text-xs font-semibold text-[#556056] hover:text-[#1E6B38] px-3 py-1.5 rounded-full hover:bg-white border border-transparent hover:border-[#E5E1D5] transition-all hidden md:flex items-center gap-1.5"
              title="System Architecture & Verification"
            >
              <svg className="w-3.5 h-3.5 text-[#1E6B38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <span>System Architecture</span>
            </Link>

            {/* Candidate Profile Avatar Icon */}
            <Link
              href="/profile"
              className={`flex items-center gap-2.5 pl-1.5 py-1 pr-3 rounded-full border transition-all cursor-pointer ${
                path === "/profile"
                  ? "bg-[#EAF4EB] border-[#C5E1CB] shadow-xs"
                  : "bg-white border-[#E5E1D5] hover:border-[#1E6B38] shadow-2xs"
              }`}
              title="Open Persistent Candidate Profile"
            >
              <div className="w-8 h-8 rounded-full bg-[#1E6B38] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {profile.name ? profile.name.charAt(0) : "P"}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-[#141A16] leading-none">{profile.name || "Palak Bhatt"}</p>
                <p className="text-[10px] text-[#6B756E] leading-tight">Candidate Profile</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-[#556056] hover:text-rose-700 px-3 py-2 rounded-full bg-white border border-[#E5E1D5] hover:border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Log out"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>

        </div>
      </header>

      {/* System Status / Agent Action Banners */}
      {(busy || error || notice) && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-sm transition-all ${
            error
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : busy
              ? "bg-[#EAF4EB] border-[#C5E1CB] text-[#1E6B38]"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}>
            {busy && (
              <div className="animate-spin w-4 h-4 border-2 border-[#1E6B38] border-t-transparent rounded-full shrink-0" />
            )}
            <span>{error ? `Attention: ${error}` : busy ? `${busy}…` : notice}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        <main className="w-full">
          {children}
          {mode === "rules" && (
            <p className="text-xs text-[#78827A] mt-4 text-center">
              Running in deterministic fallback mode (RapidFuzz & exact matching).
            </p>
          )}
        </main>
      </div>

      {/* Persistent Footer */}
      <footer className="mt-auto border-t border-[#ECE7DD] bg-[#FAF9F5] py-4 text-xs text-[#78827A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-slate-800">Skillora</span>
            <span>· Deterministic Grounding & Multi-Agent Architecture</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/job" className="hover:text-[#141A16] hover:underline">Workspace</Link>
            <Link href="/profile" className="hover:text-[#141A16] hover:underline">Candidate Profile</Link>
            <Link href="/logs" className="hover:text-[#141A16] hover:underline">Live Logs</Link>
            <Link href="/faculty" className="hover:text-[#141A16] hover:underline">System Architecture</Link>
          </div>
        </div>
      </footer>

      {/* Interactive Agent Architecture Modal on Every Screen */}
      <AgentArchitectureModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
      />
    </div>
  );
}
