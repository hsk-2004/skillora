"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, getToken, setToken } from "@/lib/api";
import Ambient from "@/components/Ambient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/sources");
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r =
        mode === "signup"
          ? await api.signup(email, password, name)
          : await api.login(email, password);
      setToken(r.token);
      window.location.href = "/sources"; // full reload so no data from a previous account stays in memory
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#141A16] flex flex-col justify-between relative selection:bg-[#DCFCE7] selection:text-[#166534]">
      <Ambient />

      {/* Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Skillora Logo" width={28} height={28} priority />
          <span className="text-xl font-serif font-bold text-[#141A16]">Skillora</span>
        </Link>
        <Link href="/how-it-works" className="text-xs font-semibold text-[#556056] hover:text-[#141A16]">
          How It Works →
        </Link>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 max-w-5xl mx-auto px-4 flex items-center justify-center py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center w-full">
          
          {/* Left value proposition */}
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1E6B38] bg-[#EAF4EB] px-2.5 py-0.5 rounded-full border border-[#C5E1CB]">
              Candidate Workspace
            </span>
            <h1 className="text-4xl sm:text-5xl font-serif font-normal text-[#141A16] tracking-tight leading-tight">
              Your Experience.<br />
              <span className="text-[#1E6B38] italic">Your Private Ledger.</span>
            </h1>
            <p className="text-sm text-[#556056] leading-relaxed">
              Every project, repository, and metric stays encrypted in your personal SQLite ledger. Tailor resumes with verified citations and zero made-up claims.
            </p>
            <div className="space-y-2 pt-2 text-xs text-[#556056]">
              <div className="flex items-center gap-2">
                <span className="text-[#1E6B38] font-bold">✓</span>
                <span>Multi-modal parsing of GitHub repos, PDFs, and slide decks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#1E6B38] font-bold">✓</span>
                <span>Deterministic ATS fit scoring with RapidFuzz and sentence embeddings</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#1E6B38] font-bold">✓</span>
                <span>Automated grounding checks rejecting unsupported metrics</span>
              </div>
            </div>
          </div>

          {/* Right card form */}
          <div className="lg:col-span-6 bg-white p-8 rounded-2xl border border-[#ECE7DD] shadow-[0_2px_14px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center justify-between border-b border-[#ECE7DD] pb-3">
              <h2 className="text-lg font-serif font-bold text-[#141A16]">
                {mode === "login" ? "Sign In to Skillora" : "Create Candidate Account"}
              </h2>
              <div className="flex items-center gap-1 bg-[#FAF9F5] p-1 rounded-lg border border-[#ECE7DD]">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${
                    mode === "login" ? "bg-white text-[#1E6B38] shadow-sm" : "text-[#78827A]"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${
                    mode === "signup" ? "bg-white text-[#1E6B38] shadow-sm" : "text-[#78827A]"
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#141A16]">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E5E1D5] bg-[#FAF9F6] text-xs sm:text-sm text-[#141A16] focus:outline-none focus:border-[#1E6B38]"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#141A16]">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E5E1D5] bg-[#FAF9F6] text-xs sm:text-sm text-[#141A16] focus:outline-none focus:border-[#1E6B38]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#141A16]">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E5E1D5] bg-[#FAF9F6] text-xs sm:text-sm text-[#141A16] focus:outline-none focus:border-[#1E6B38]"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-[#1E6B38] hover:bg-[#16532B] text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {busy ? "Signing in..." : mode === "login" ? "Enter Workspace →" : "Create Account →"}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-[#78827A]">
              <span>Demo Mode active: you can sign in directly or proceed as guest.</span>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 text-xs text-[#78827A] flex items-center justify-between border-t border-[#ECE7DD]">
        <span>Skillora © 2026 · Deterministic Resume Intelligence</span>
        <Link href="/sources" className="text-[#1E6B38] font-semibold hover:underline">
          Guest Demo Access →
        </Link>
      </footer>
    </div>
  );
}
