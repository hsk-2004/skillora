"use client";

import { useState } from "react";
import SectionHeading from "@/components/SectionHeading";

type Key = "K" | "J" | "E" | "Q" | "A";

const card = "rounded-2xl border border-[#E5E1D5] bg-white p-5 shadow-2xs";
const muted = "text-sm text-[#556056] leading-relaxed";
const mono = "font-mono font-bold text-[#1E6B38]";

const sections = [
  { id: "formula", title: "The formula" },
  { id: "parts", title: "The 5 parts" },
  { id: "profiles", title: "Profiles" },
  { id: "missing", title: "Missing parts" },
  { id: "try", title: "Try it" },
  { id: "rules", title: "Fair play" },
];

const NAMES: Record<Key, string> = { K: "Skills match", J: "Responsibility fit", E: "Relevant experience", Q: "Evidence quality", A: "Education" };
const DOT: Record<Key, string> = { K: "bg-emerald-500", J: "bg-sky-500", E: "bg-violet-500", Q: "bg-amber-500", A: "bg-rose-500" };

const parts: { k: Key; ask: string; how: string[] }[] = [
  {
    k: "K",
    ask: "Do you have the skills the job asks for?",
    how: [
      "Each required skill gets a match value: 1.0 if you used it in a project or job, 0.7 if it is only listed, 0.5 if related or only self-declared, 0 if missing.",
      "Average the required skills, average the preferred skills, then blend them: required 75% and preferred 25% (graduate profile 70% and 30%).",
    ],
  },
  {
    k: "J",
    ask: "Have you done the same kind of work, not just used the same tools?",
    how: ["J = 0.6 x (how well the job's responsibilities are evidenced) + 0.4 x (relevance of your best selected project).", "If the job lists no responsibilities, J is just the best project's relevance."],
  },
  {
    k: "E",
    ask: "Do you have enough years of experience?",
    how: ["E = your years / years the job asks for, capped at 100%.", "An entry-level job asking 0 years gives 100. Only scored when both numbers are known."],
  },
  {
    k: "Q",
    ask: "How strong is the proof in your bullets?",
    how: [
      "Q = 0.40 x directness + 0.35 x ownership + 0.25 x verifiability.",
      "Directness: the bullet names a real skill or tool. Ownership: starts with a strong verb (built, developed, deployed = 1; worked on, helped = 0; others 0.6).",
      "Verifiability: a verified bullet with a number or two or more skills = 1; verified without = 0.5; not verified = 0.",
    ],
  },
  {
    k: "A",
    ask: "Does your education meet what the job asks?",
    how: [
      "Education requirements are matched, with required ones counting 3 times more than preferred ones.",
      "No education requirement but a verified degree on file = 100. No requirement and no education found = 50 (neutral).",
    ],
  },
];

const profiles: { id: string; label: string; when: string; w: Record<Key, number> }[] = [
  { id: "standard", label: "Standard", when: "Balanced default. Skills count the most.", w: { K: 40, J: 25, E: 15, Q: 10, A: 10 } },
  { id: "skills_first", label: "Skills-first", when: "Hands-on technical roles.", w: { K: 50, J: 25, E: 10, Q: 10, A: 5 } },
  { id: "credentials_first", label: "Credentials-first", when: "Education and qualifications matter more.", w: { K: 30, J: 20, E: 15, Q: 10, A: 25 } },
  { id: "graduate", label: "Graduate / entry-level", when: "No experience requirement: projects, evidence and education lead.", w: { K: 35, J: 30, E: 0, Q: 20, A: 15 } },
];

const order: Key[] = ["K", "J", "E", "Q", "A"];

export default function ScoreFormulaPage() {
  const [pid, setPid] = useState("standard");
  const [vals, setVals] = useState<Record<Key, number>>({ K: 80, J: 80, E: 100, Q: 60, A: 100 });
  const [eKnown, setEKnown] = useState(true);

  const prof = profiles.find((p) => p.id === pid) ?? profiles[0];
  const active = order.filter((k) => prof.w[k] > 0 && (k !== "E" || eKnown));
  const wsum = active.reduce((s, k) => s + prof.w[k], 0) || 1;
  const total = Math.round(active.reduce((s, k) => s + vals[k] * prof.w[k], 0) / wsum);

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <header className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#1E6B38]">Scoring engine</p>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#141A16] tracking-tight mt-1">How the score is calculated</h1>
          <p className={`${muted} mt-2 max-w-2xl`}>
            The job-fit score is plain maths written in Python. No AI model guesses it, so the same resume and job always give the same score, and every point can be explained.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}
              className="text-xs font-semibold text-[#556056] hover:text-[#1E6B38] bg-white hover:bg-[#EAF4EB] border border-[#E5E1D5] hover:border-[#C5E1CB] px-3 py-1.5 rounded-full transition-all">
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
      </header>

      {/* 1 Formula */}
      <section className="space-y-4">
        <SectionHeading n={1} id="formula" title="The formula" sub="One line. Five parts, each scored 0 to 100, then mixed by weight." />
        <div className={`${card} bg-[#EAF4EB] border-[#C5E1CB] text-center py-8`}>
          <p className="font-mono font-bold text-xl sm:text-2xl text-[#141A16]">
            S = w<sub>K</sub>&middot;K + w<sub>J</sub>&middot;J + w<sub>E</sub>&middot;E + w<sub>Q</sub>&middot;Q + w<sub>A</sub>&middot;A
          </p>
          <p className="text-xs text-[#556056] mt-3">S is the final score out of 100. Each w is the weight of that part, and the weights add up to 100%.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {order.map((k) => (
            <div key={k} className={card}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${DOT[k]}`} />
                <span className={mono}>{k}</span>
              </div>
              <p className="text-sm font-bold text-[#141A16] mt-1">{NAMES[k]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2 Parts */}
      <section className="space-y-4">
        <SectionHeading n={2} id="parts" title="The 5 parts" sub="What each one asks, and how it is worked out." />
        <div className="space-y-3">
          {parts.map((p) => (
            <div key={p.k} className={card}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${DOT[p.k]}`} />
                <p className="text-sm font-bold text-[#141A16]"><span className={mono}>{p.k}</span> &middot; {NAMES[p.k]}</p>
              </div>
              <p className="text-sm font-semibold text-[#1E6B38] mt-2">{p.ask}</p>
              <ul className={`${muted} mt-2 space-y-1.5 list-disc pl-4`}>
                {p.how.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Profiles */}
      <section className="space-y-4">
        <SectionHeading n={3} id="profiles" title="Profiles: the weights" sub="Different jobs care about different things, so there are four weight sets. Each adds up to 100." />
        <div className={`${card} p-0 overflow-hidden`}>
          <div className="hidden sm:grid grid-cols-[190px_repeat(5,60px)_1fr] gap-3 px-4 py-2.5 bg-[#FAF9F5] border-b border-[#ECE7DD] text-[11px] font-bold uppercase tracking-wider text-[#6B756E]">
            <span>Profile</span>{order.map((k) => <span key={k} className="text-center">w{k}</span>)}<span>Use it for</span>
          </div>
          {profiles.map((p) => (
            <div key={p.id} className="grid sm:grid-cols-[190px_repeat(5,60px)_1fr] gap-x-3 gap-y-1 px-4 py-3 border-b border-[#F0ECE2] last:border-b-0 items-center">
              <span className="text-sm font-bold text-[#141A16]">{p.label}</span>
              {order.map((k) => <span key={k} className={`text-sm font-mono text-center ${p.w[k] === 0 ? "text-[#B0B7B2]" : "text-[#141A16]"}`}>{p.w[k]}%</span>)}
              <span className="text-xs text-[#556056]">{p.when}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 Missing */}
      <section className="space-y-4">
        <SectionHeading n={4} id="missing" title="When a part cannot be scored" sub="We never punish you for missing information." />
        <div className={card}>
          <p className={muted}>
            If a part cannot be scored (for example your years of experience are not known), it is left out and its weight is shared among the other parts. The final score is:
          </p>
          <p className="font-mono font-bold text-base text-[#141A16] mt-3">
            S = (sum of value x weight for scored parts) / (sum of weights of scored parts)
          </p>
          <p className={`${muted} mt-3`}>The graduate profile sets the experience weight to 0 on purpose, because entry-level jobs do not ask for years.</p>
        </div>
      </section>

      {/* 5 Try it */}
      <section className="space-y-4">
        <SectionHeading n={5} id="try" title="Try it" sub="Move the sliders and watch the score change. This uses the same weights as the engine." />
        <div className={`${card} space-y-5`}>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button key={p.id} type="button" onClick={() => setPid(p.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${pid === p.id ? "bg-[#1E6B38] text-white border-[#1E6B38]" : "bg-white text-[#556056] border-[#E5E1D5] hover:border-[#1E6B38]"}`}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_220px] items-start">
            <div className="space-y-3">
              {order.map((k) => {
                const w = prof.w[k];
                const off = w === 0 || (k === "E" && !eKnown);
                return (
                  <div key={k} className={off ? "opacity-40" : ""}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#141A16]"><span className={mono}>{k}</span> {NAMES[k]}</span>
                      <span className="font-mono text-[#556056]">value {vals[k]} &times; weight {off ? 0 : Math.round((100 * w) / wsum)}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={vals[k]} disabled={off}
                      onChange={(e) => setVals({ ...vals, [k]: Number(e.target.value) })} className="w-full accent-[#1E6B38]" />
                  </div>
                );
              })}
              <label className="flex items-center gap-2 text-xs text-[#556056] cursor-pointer pt-1">
                <input type="checkbox" checked={eKnown} onChange={(e) => setEKnown(e.target.checked)} className="accent-[#1E6B38]" />
                My years of experience are known (untick to see the weight shared among the others)
              </label>
            </div>

            <div className="rounded-2xl bg-[#EAF4EB] border border-[#C5E1CB] p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-[#1E6B38]">Final score</p>
              <p className="text-6xl font-serif text-[#141A16] mt-1">{total}</p>
              <p className="text-xs text-[#556056] mt-1">out of 100</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B756E]">The working</p>
            <p className="font-mono text-xs text-[#141A16] mt-2 leading-relaxed break-words">
              {active.map((k, i) => `${i ? " + " : ""}(${vals[k]} x ${prof.w[k]})`).join("")} = {active.reduce((s, k) => s + vals[k] * prof.w[k], 0)}
              <br />
              {active.reduce((s, k) => s + vals[k] * prof.w[k], 0)} / {wsum} = {(active.reduce((s, k) => s + vals[k] * prof.w[k], 0) / wsum).toFixed(1)} &rarr; rounded to {total}
            </p>
          </div>
        </div>
      </section>

      {/* 6 Fair play */}
      <section className="space-y-4 pb-8">
        <SectionHeading n={6} id="rules" title="Fair play" sub="What keeps the score honest and explainable." />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { t: "Deterministic", d: "Plain Python, no AI guessing. The same input always gives the same score. We tested 30 shuffled runs and got one score." },
            { t: "Evidence-based", d: "A skill you only list counts less than a skill you used in a project. A claim with no proof counts less again." },
            { t: "Eligibility is separate", d: "Must-have qualifications are shown on their own, not hidden in the score. Not found on your resume does not mean you lack it." },
            { t: "Our own weights", d: "This is an ATS-style model built from general, public techniques. It is not any company's real scoring, and the weights are our starting assumptions to be validated." },
          ].map((x) => (
            <div key={x.t} className={card}>
              <p className="text-sm font-bold text-[#1E6B38]">{x.t}</p>
              <p className={`${muted} mt-1`}>{x.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
