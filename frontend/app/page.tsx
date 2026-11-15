"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RequirementsModal from "@/components/RequirementsModal";
import { TEAM } from "@/lib/team";

export default function Home() {
  const [showPricing, setShowPricing] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  return (
    <div className="h-screen w-screen max-h-screen overflow-hidden bg-[#FAF9F5] text-[#141A16] relative flex flex-col justify-between selection:bg-[#DCFCE7] selection:text-[#166534]">
      
      {/* Ambient background soft glow orbs matching reference */}
      <div className="absolute top-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full bg-[#E5F5E6]/70 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[-5%] right-[-10%] w-[550px] h-[550px] rounded-full bg-[#FEF9C3]/50 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-15%] left-[25%] w-[650px] h-[500px] rounded-full bg-[#DCFCE7]/45 blur-[150px] pointer-events-none -z-10" />

      {/* Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 lg:px-12 pt-4 pb-2 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-7 h-7 transition-transform group-hover:rotate-12 duration-300">
            <Image 
              src="/logo.png" 
              alt="Skillora Logo" 
              width={30} 
              height={30} 
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-[#141A16]">
            Skillora
          </span>
        </Link>

        {/* Center Nav Links: Home, How It Works, Pricing, Resources */}
        <nav 
          className="hidden md:flex items-center text-xs font-semibold text-[#465048]"
          style={{ display: "flex", alignItems: "center", gap: "24px" }}
        >
          <Link 
            href="/" 
            className="px-3.5 py-1.5 rounded-xl hover:text-[#1E6B38] hover:bg-[#EAF4EB] transition-all"
            style={{ marginRight: "6px" }}
          >
            Home
          </Link>
          <Link 
            href="/how-it-works" 
            className="px-3.5 py-1.5 rounded-xl hover:text-[#1E6B38] hover:bg-[#EAF4EB] transition-all whitespace-nowrap"
            style={{ marginRight: "6px" }}
          >
            How It Works
          </Link>
          <button
            type="button"
            onClick={() => setShowPricing(true)}
            className="px-3.5 py-1.5 rounded-xl hover:text-[#1E6B38] hover:bg-[#EAF4EB] transition-all cursor-pointer whitespace-nowrap"
            style={{ marginRight: "6px" }}
          >
            Pricing
          </button>
          <button
            type="button"
            onClick={() => setShowTeam(true)}
            className="px-3.5 py-1.5 rounded-xl hover:text-[#1E6B38] hover:bg-[#EAF4EB] transition-all cursor-pointer whitespace-nowrap"
            style={{ marginRight: "6px" }}
          >
            Team
          </button>
          <button
            type="button"
            onClick={() => setShowResources(true)}
            className="px-3.5 py-1.5 rounded-xl hover:text-[#1E6B38] hover:bg-[#EAF4EB] transition-all cursor-pointer whitespace-nowrap"
          >
            Resources
          </button>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          {/* Requirements for Evaluators */}
          <button
            type="button"
            onClick={() => setShowRequirements(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EAF4EB] text-[#1E6B38] border border-[#BDE0C3] hover:bg-[#D5EBD7] transition-all cursor-pointer shadow-xs"
            title="View Requirements"
          >
            <svg className="w-3.5 h-3.5 text-[#1E6B38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Requirements</span>
          </button>

          <Link 
            href="/login" 
            className="hidden sm:inline-block text-xs font-medium text-[#465048] hover:text-[#141A16] transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/job" 
            className="px-4 py-2 bg-[#121614] hover:bg-black text-white text-xs font-medium rounded-full shadow-sm hover:shadow transition-all flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <span className="text-[11px]">→</span>
          </Link>
        </div>
      </header>

      {/* Hero Section (Non-scrollable, perfectly fitted) */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 flex flex-col items-center justify-between min-h-0 pt-2 pb-0">
        
        {/* Main Headline & CTAs */}
        <div className="text-center max-w-3xl mx-auto space-y-2 shrink-0">
          <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-serif font-normal text-[#121614] tracking-[-0.035em] leading-[1.06]">
            One Profile.<br />
            <span className="relative inline-block">
              A Resume
              {/* Hand-drawn sage green brush underline */}
              <svg 
                className="absolute -bottom-1.5 left-0 w-full text-[#9FD4A2] pointer-events-none" 
                viewBox="0 0 270 14" 
                fill="none"
              >
                <path 
                  d="M4 10.5C70 4.2 205 3.5 266 9.8" 
                  stroke="currentColor" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                />
              </svg>
            </span> for Every Job.
          </h1>

          <p className="text-[#556056] text-xs sm:text-sm font-normal max-w-xl mx-auto leading-relaxed">
            Turn your verified projects and experience into tailored resumes with clear, explainable job-fit insights.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link 
              href="/job" 
              className="px-6 py-2.5 bg-[#121614] hover:bg-black text-white rounded-full font-medium text-xs sm:text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <span>Get Started Free</span>
              <span>→</span>
            </Link>

            <Link 
              href="/job" 
              className="px-5 py-2.5 bg-white hover:bg-[#F4F3ED] text-[#141A16] border border-[#DDD9CE] rounded-full font-medium text-xs sm:text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[8px] pl-0.5">▶</span>
              <span>Explore Demo</span>
            </Link>
          </div>

          {/* Team credit */}
          <p className="pt-3 text-[11px] text-[#6B756E]">
            Built by{" "}
            <button type="button" onClick={() => setShowTeam(true)} className="font-semibold text-[#1E6B38] hover:underline cursor-pointer">
              {TEAM.map((m) => m.name).join(" · ")}
            </button>
          </p>
        </div>

        {/* Floating Interactive Device Showcase Area with 3D inward perspective tilt */}
        <div className="w-full relative flex-1 flex items-end justify-center max-w-4xl min-h-0 mt-2 [perspective:1100px]">
          
          {/* Card 1: Top Left Floating Photo (Verified Projects) */}
          <div className="hidden lg:block absolute top-2 -left-12 z-20 animate-float-1 pointer-events-none">
            <div className="relative p-1.5 bg-white/95 rounded-2xl shadow-xl shadow-slate-300/40 border border-[#E9E6DC] -rotate-3">
              <div className="relative w-40 h-28 rounded-xl overflow-hidden">
                <Image 
                  src="/workspace.jpg" 
                  alt="Workspace" 
                  fill 
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-3 left-3 bg-[#F5ECFE] text-[#7E22CE] border border-[#E9D5FF] px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7E22CE]" />
                <span>Verified Projects</span>
              </div>
            </div>
          </div>

          {/* Card 2: Bottom Left Floating Widget (92% Job Fit Score) */}
          <div className="hidden lg:block absolute bottom-12 -left-14 z-20 animate-float-2 pointer-events-none">
            <div className="bg-[#FAF7F0]/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#EBE7DD] shadow-xl shadow-slate-300/50 w-52 -rotate-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-[#141A16] tracking-tight">92%</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-[#EFECE3] flex items-center justify-center text-[10px] font-bold text-slate-700">
                  ↗
                </div>
              </div>
              <p className="text-[10px] font-semibold text-[#6A756D] mt-0.5">Job Fit Score</p>
              
              <div className="w-full h-2 bg-[#E6E2D8] rounded-full overflow-hidden mt-2">
                <div className="h-full bg-[#1E6B38] rounded-full w-[92%]"></div>
              </div>
            </div>
          </div>

          {/* Card 3: Top Right Floating Card (Tailored Resume & Sparkles) */}
          <div className="hidden lg:block absolute top-2 -right-10 z-20 animate-float-2 pointer-events-none">
            <div className="relative bg-[#EDF8EE]/95 backdrop-blur-md p-4 rounded-2xl border border-[#D5EED8] shadow-xl shadow-slate-300/40 w-56 rotate-3">
              {/* Yellow sunburst energy lines */}
              <div className="absolute -top-3 -right-2.5 text-[#F59E0B] font-black text-xs select-none">
                ///
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#141A16] flex items-center gap-1">
                    Tailored Resume
                    <span className="text-emerald-600 text-[10px]">✦</span>
                  </h4>
                  <p className="text-[10px] text-[#526056] mt-0.5 leading-snug">
                    Built from your real experience. No made-up claims.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Bottom Right Floating Candidate Card (More Interviews) */}
          <div className="hidden lg:block absolute bottom-12 -right-8 z-20 animate-float-1 pointer-events-none">
            <div className="relative p-1.5 bg-white/95 rounded-2xl shadow-xl shadow-slate-300/40 border border-[#E9E6DC] rotate-3">
              <div className="relative w-36 h-28 rounded-xl overflow-hidden">
                <Image 
                  src="/candidate.jpg" 
                  alt="Candidate" 
                  fill 
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-3 right-1 bg-white text-[#141A16] border border-[#E5E2D8] px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-md flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>More interviews for the right roles.</span>
              </div>
            </div>
          </div>

          {/* Decorative Sparkles */}
          <div className="hidden lg:block absolute top-4 left-1/4 text-slate-400 text-sm select-none pointer-events-none">✦</div>
          <div className="hidden lg:block absolute top-14 right-1/4 text-slate-700 text-xs select-none pointer-events-none">✦</div>
          <div className="hidden lg:block absolute bottom-20 right-1/3 text-emerald-700 text-[10px] select-none pointer-events-none">✦</div>

          {/* Central Inward-Tilted Tablet Frame with Bottom Blur */}
          <div 
            className="w-full max-w-3xl relative [transform-style:preserve-3d] transition-transform duration-700 select-none"
            style={{
              transform: 'rotateX(18deg) translateY(24px)',
              transformOrigin: 'bottom center',
            }}
          >
            {/* Tablet Casing */}
            <div 
              className="relative bg-[#181C19] p-2.5 sm:p-3.5 rounded-t-[32px] sm:rounded-t-[42px] rounded-b-xl shadow-2xl shadow-slate-900/40 border-t-4 border-x-4 border-b-0 border-[#2D352F] overflow-hidden"
              style={{
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0) 100%)',
              }}
            >
              
              {/* Display Window */}
              <div className="bg-white rounded-t-[22px] sm:rounded-t-[30px] rounded-b-none overflow-hidden border border-slate-200">
                
                {/* Window Header with traffic light dots */}
                <div className="bg-[#FAF9F5] px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                    skillora.ai/tailor/workspace
                  </div>
                  <div className="w-8"></div>
                </div>

                {/* Inside App Workspace */}
                <div className="grid grid-cols-1 md:grid-cols-12 h-[290px] sm:h-[330px]">
                  
                  {/* App Sidebar */}
                  <div className="hidden md:flex md:col-span-3 bg-[#FAF9F5] border-r border-slate-200 p-3.5 flex-col justify-between">
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-2 px-1 py-0.5">
                        <Image src="/logo.png" alt="Logo" width={20} height={20} />
                        <span className="font-serif font-bold text-sm text-[#141A16]">Skillora</span>
                      </div>

                      <nav className="space-y-1">
                        <Link 
                          href="/sources"
                          className="w-full text-left px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EAF4EB] text-[#1E6B38] flex items-center gap-2 transition-colors"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B38]" />
                          <span>1. Sources</span>
                        </Link>
                        <Link 
                          href="/verify"
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>2. Verify</span>
                        </Link>
                        <Link 
                          href="/job"
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>3. Job Match</span>
                        </Link>
                        <Link 
                          href="/tailor"
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>4. Tailor</span>
                        </Link>
                      </nav>
                    </div>

                    <div className="pt-2 border-t border-slate-200 px-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[9px] font-bold flex items-center justify-center">
                          P
                        </div>
                        <div className="truncate">
                          <p className="text-[10px] font-semibold text-slate-800">Palak Bhatt</p>
                          <p className="text-[8px] text-emerald-700 font-medium">Ledger Grounded</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Resume Canvas */}
                  <div className="md:col-span-9 p-5 sm:p-6 flex flex-col justify-between bg-white overflow-hidden">
                    
                    <div className="space-y-3.5">
                      {/* Top Bar inside app */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-lg font-serif font-bold text-[#141A16]">Tailored Resume</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Software Engineer · Production Ready</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link 
                            href="/tailor" 
                            className="px-3 py-1 rounded-full bg-[#F3F2EC] hover:bg-[#EBE9E0] text-xs font-medium text-slate-800 border border-[#DCD9CE] flex items-center gap-1 transition-all shadow-sm"
                          >
                            <span>✎</span>
                            <span>Tailor & Ground</span>
                          </Link>
                          {/* Phase 2 Export - Commented out for Mid-Term
                          <Link
                            href="/export"
                            className="px-3.5 py-1 bg-[#141A16] hover:bg-black text-white text-xs font-medium rounded-full flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <span>⤓</span>
                            <span>Export</span>
                          </Link>
                          */}
                        </div>
                      </div>

                      {/* Resume Body with Grounded Claims */}
                      <div className="space-y-2 text-xs">
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs tracking-tight">Experience</h4>
                          <div className="mt-2 space-y-2.5">
                            <div className="flex items-start gap-2">
                              <span className="text-[#1E6B38] font-bold">•</span>
                              <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                                Engineered a multi-agent resume tailoring pipeline using <span className="font-semibold text-slate-900">CrewAI</span> and <span className="font-semibold text-slate-900">Google ADK</span> with deterministic fact grounding.
                              </p>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="text-[#1E6B38] font-bold">•</span>
                              <div className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                                Implemented a 5-component explainable ATS scoring engine with <span className="font-semibold text-slate-900">RapidFuzz</span> and vector semantic matching.
                                <span className="inline-block w-28 h-2.5 bg-[#BFE5C6] rounded-full align-middle ml-2 opacity-90" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-slate-400 font-bold">•</span>
                              <div className="w-3/4 h-2 bg-[#EBE9E1] rounded-full" />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-bold">•</span>
                              <div className="w-4/5 h-2 bg-[#EBE9E1] rounded-full" />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-bold">•</span>
                              <div className="w-3/5 h-2 bg-[#EBE9E1] rounded-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Link to Action */}
                    <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-slate-600 font-medium">0% Hallucination Verifier Active</span>
                      </div>
                      <Link 
                        href="/sources"
                        className="font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                      >
                        <span>Launch Workflow</span>
                        <span>→</span>
                      </Link>
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* Seamless Bottom Gradient Blur & Fade to Background Canvas */}
            <div className="absolute -bottom-6 inset-x-0 h-32 sm:h-44 bg-gradient-to-t from-[#FAF9F5] via-[#FAF9F5]/85 to-transparent pointer-events-none z-30" />
          </div>

        </div>

      </main>

      {/* Team Modal */}
      {showTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowTeam(false)}>
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#ECE7DD] shadow-2xl space-y-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTeam(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E6B38] bg-[#EAF4EB] px-2.5 py-0.5 rounded-full border border-[#C5E1CB]">
                CSE3101 Agentic AI
              </span>
              <h3 className="text-2xl font-serif font-bold text-[#141A16]">Meet the team</h3>
              <p className="text-xs text-[#556056] leading-relaxed">Four builders, one verifiable career profile.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEAM.map((m) => (
                <div key={m.name} className="p-4 rounded-2xl border border-[#ECE7DD] bg-[#FAF9F5] space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1E6B38] text-white text-sm font-bold flex items-center justify-center shrink-0">
                      {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#141A16] leading-tight">{m.name}</p>
                      <p className="text-[11px] font-semibold text-[#1E6B38]">{m.role}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#556056] leading-relaxed">{m.focus}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {showPricing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#ECE7DD] shadow-2xl space-y-6 relative">
            <button
              onClick={() => setShowPricing(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E6B38] bg-[#EAF4EB] px-2.5 py-0.5 rounded-full border border-[#C5E1CB]">
                Simple &amp; Transparent
              </span>
              <h3 className="text-2xl font-serif font-bold text-[#141A16]">
                Plans &amp; Access
              </h3>
              <p className="text-xs text-[#556056] leading-relaxed">
                Skillora is built as an open-source, verifiable career intelligence platform.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Academic / Open Source */}
              <div className="p-5 rounded-2xl border-2 border-[#1E6B38] bg-[#FAF9F5] space-y-3 relative">
                <span className="text-[10px] font-bold text-[#1E6B38] bg-[#EAF4EB] border border-[#C5E1CB] px-2 py-0.5 rounded-full uppercase">
                  Community &amp; Viva
                </span>
                <div>
                  <h4 className="text-base font-bold text-[#141A16]">Student &amp; Academic</h4>
                  <p className="text-2xl font-serif font-bold text-[#1E6B38] mt-1">₹0 <span className="text-xs font-sans text-slate-500 font-normal">/ forever</span></p>
                </div>
                <ul className="text-xs text-[#556056] space-y-2">
                  <li className="flex items-center gap-1.5">✓ 4-Stage Multi-Agent Pipeline</li>
                  <li className="flex items-center gap-1.5">✓ Local SQLite Grounding Ledger</li>
                  <li className="flex items-center gap-1.5">✓ CrewAI Flow &amp; Google ADK</li>
                  <li className="flex items-center gap-1.5">✓ Verifier Callbacks (Zero Fake Claims)</li>
                </ul>
              </div>

              {/* Card 2: Pro */}
              <div className="p-5 rounded-2xl border border-[#ECE7DD] bg-white space-y-3">
                <span className="text-[10px] font-bold text-[#78827A] bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                  Phase 2 Beta
                </span>
                <div>
                  <h4 className="text-base font-bold text-[#141A16]">Pro Career Suite</h4>
                  <p className="text-2xl font-serif font-bold text-[#141A16] mt-1">Free <span className="text-xs font-sans text-slate-500 font-normal">in Beta</span></p>
                </div>
                <ul className="text-xs text-[#556056] space-y-2">
                  <li className="flex items-center gap-1.5">✓ Deterministic ATS Scoring Engine</li>
                  <li className="flex items-center gap-1.5">✓ Unlimited Target Job Descriptions</li>
                  <li className="flex items-center gap-1.5">✓ PDF &amp; Word (.DOCX) Direct Export</li>
                  <li className="flex items-center gap-1.5">✓ Multi-Profile Custom Weightings</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-[#78827A]">Open source project under MIT License</span>
              <Link
                href="/sources"
                className="px-5 py-2.5 bg-[#121614] hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Launch Workspace →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Resources Modal */}
      {showResources && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#ECE7DD] shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowResources(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E6B38] bg-[#EAF4EB] px-2.5 py-0.5 rounded-full border border-[#C5E1CB]">
                Technical Specs &amp; Links
              </span>
              <h3 className="text-2xl font-serif font-bold text-[#141A16]">
                Developer Resources
              </h3>
              <p className="text-xs text-[#556056] leading-relaxed">
                Documentation, architecture charts, evaluation scripts, and source code.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowResources(false);
                  setShowRequirements(true);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-[#C5E1CB] bg-[#EAF4EB] hover:bg-[#D5EBD7] flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="p-1.5 rounded-lg bg-white border border-[#C5E1CB] text-[#1E6B38]">
                    <svg className="w-4 h-4 text-[#1E6B38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-[#1E6B38]">Requirements</h5>
                    <p className="text-[11px] text-[#2C6B38]">Verified rubric checklist with live MCP &amp; Eval test proofs</p>
                  </div>
                </div>
                <span className="text-xs text-[#1E6B38] font-bold">Open →</span>
              </button>

              <Link
                href="/how-it-works"
                className="p-3.5 rounded-xl border border-[#ECE7DD] bg-[#FAF9F5] hover:bg-[#EAF4EB] hover:border-[#C5E1CB] flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E1D5] flex items-center justify-center text-[#1E6B38] shrink-0">
                    <svg className="w-4 h-4 text-[#1E6B38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#141A16] group-hover:text-[#1E6B38]">Multi-Agent Architecture Guide</h5>
                    <p className="text-[11px] text-[#78827A]">Detailed breakdown of CrewAI flows &amp; Google ADK agent roles</p>
                  </div>
                </div>
                <span className="text-xs text-[#1E6B38] font-bold">Read →</span>
              </Link>

              <a
                href="https://github.com/palakbhatt1/SkillOra"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl border border-[#ECE7DD] bg-[#FAF9F5] hover:bg-[#EAF4EB] hover:border-[#C5E1CB] flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E1D5] flex items-center justify-center text-[#141A16] shrink-0">
                    <svg className="w-4 h-4 text-[#141A16]" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#141A16] group-hover:text-[#1E6B38]">GitHub Repository</h5>
                    <p className="text-[11px] text-[#78827A]">Source code, backend FastAPI services, and Docker configs</p>
                  </div>
                </div>
                <span className="text-xs text-[#1E6B38] font-bold">GitHub ↗</span>
              </a>

              <div className="p-3.5 rounded-xl border border-[#ECE7DD] bg-[#FAF9F5] space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-[#EAF4EB] text-[#1E6B38] flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#1E6B38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h5 className="text-xs font-bold text-[#141A16]">Evaluation Benchmarks</h5>
                </div>
                <p className="text-[11px] text-[#556056] leading-relaxed">
                  100% Fact Recall · 100% Citation Validity · 97% Fabrication Catch Rate on CSE3101 test sets.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#ECE7DD] text-[10px] text-[#78827A] flex items-center justify-between">
              <span>SkillOra v1.0 · CSE3101 Project</span>
              <span>Palak · Manya · Vanshik · Harman</span>
            </div>
          </div>
        </div>
      )}

      {/* 11 Requirements Matrix Modal */}
      <RequirementsModal isOpen={showRequirements} onClose={() => setShowRequirements(false)} />

    </div>
  );
}
