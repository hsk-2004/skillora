"use client";

// A small worked example of the job-fit score, calculated with the same formula as the scoring engine (backend/app/engine/scoring.py).
// The numbers below were checked against the real engine: 85 before, 89 after declaring a skill, 93 after proving it with a project.

type Req = { name: string; level: "Required" | "Preferred" | "Education"; status: string; value: number };

const reqs: Req[] = [
  { name: "Python", level: "Required", status: "Used in a project", value: 1 },
  { name: "FastAPI", level: "Required", status: "Used in a project", value: 1 },
  { name: "PostgreSQL", level: "Required", status: "Used in a project", value: 1 },
  { name: "LangChain", level: "Required", status: "Used in a project", value: 1 },
  { name: "Kubernetes", level: "Required", status: "Not found", value: 0 },
  { name: "Docker", level: "Preferred", status: "Used in a project", value: 1 },
  { name: "Relevant degree", level: "Education", status: "Verified degree", value: 1 },
];

// Standard profile weights. Experience is not scored here (years unknown), so its weight is shared out: the weights below add up to 85.
const W = { K: 40, J: 25, Q: 10, A: 10 };
const WSUM = W.K + W.J + W.Q + W.A;
const PREF_SHARE = 0.25;
const J = 80; // best selected project relevance
const A = 100; // verified degree meets the education requirement
const Q = 100 * (0.4 * 0.8 + 0.35 * (11 / 12) + 0.25 * 0.9); // 0.40 directness + 0.35 ownership + 0.25 verifiability = 86.6

const avg = (xs: number[]) => (100 * xs.reduce((a, b) => a + b, 0)) / xs.length;
const calc = (kubernetes: number) => {
  const required = avg([1, 1, 1, 1, kubernetes]);
  const preferred = avg([1]);
  const K = (1 - PREF_SHARE) * required + PREF_SHARE * preferred;
  const sum = K * W.K + J * W.J + Q * W.Q + A * W.A;
  const total = sum / WSUM;
  return { required, preferred, K, sum, total };
};

const before = calc(0);
const declared = calc(0.5);
const proven = calc(1);

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const f2 = (n: number) => n.toFixed(2);

const box = "rounded-2xl border border-[#E5E1D5] bg-white p-5 shadow-2xs";
const muted = "text-sm text-[#556056] leading-relaxed";
const mono = "font-mono text-xs text-[#141A16] leading-relaxed";

export default function ScoreExample() {
  return (
    <div className="space-y-5">
      {/* The situation */}
      <div className={box}>
        <p className="text-sm font-bold text-[#141A16]">The example</p>
        <p className={`${muted} mt-1`}>
          A student applies for a <span className="font-semibold">Backend ML Engineer</span> job (0 to 2 years). The job lists 5 required skills, 1 preferred skill and a degree. We check each one against the
          student&apos;s verified facts.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[#ECE7DD]">
          <div className="hidden sm:grid grid-cols-[1fr_110px_190px_80px] gap-3 px-4 py-2 bg-[#FAF9F5] text-[11px] font-bold uppercase tracking-wider text-[#6B756E]">
            <span>Job asks for</span><span>Type</span><span>What we found</span><span className="text-right">Match value</span>
          </div>
          {reqs.map((r) => (
            <div key={r.name} className="grid sm:grid-cols-[1fr_110px_190px_80px] gap-x-3 gap-y-0.5 px-4 py-2 border-t border-[#F0ECE2] text-sm items-center">
              <span className="font-semibold text-[#141A16]">{r.name}</span>
              <span className="text-xs text-[#556056]">{r.level}</span>
              <span className={`text-xs ${r.value === 0 ? "text-rose-700 font-semibold" : "text-[#556056]"}`}>{r.status}</span>
              <span className="font-mono text-xs text-right text-[#1E6B38] font-bold">{r.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#78827A] mt-2">
          Match value: 1.0 = used in a project or job, 0.7 = only listed, 0.5 = self-declared or related, 0 = not found.
        </p>
      </div>

      {/* Step 1 */}
      <div className={box}>
        <p className="text-sm font-bold text-[#141A16]">Step 1 · Skills match (K)</p>
        <ul className={`${muted} mt-2 space-y-1.5 list-disc pl-4`}>
          <li>Required skills: (1 + 1 + 1 + 1 + 0) / 5 = <span className="font-mono font-bold">{f1(before.required)}</span></li>
          <li>Preferred skills: Docker = 1 / 1 = <span className="font-mono font-bold">{f1(before.preferred)}</span></li>
          <li>Blend 75% required + 25% preferred: 0.75 x {f1(before.required)} + 0.25 x {f1(before.preferred)} = <span className="font-mono font-bold text-[#1E6B38]">K = {f1(before.K)}</span></li>
        </ul>
      </div>

      {/* Step 2 */}
      <div className={box}>
        <p className="text-sm font-bold text-[#141A16]">Step 2 · The other parts</p>
        <ul className={`${muted} mt-2 space-y-1.5 list-disc pl-4`}>
          <li><span className="font-semibold">J, Responsibility:</span> the best selected project is {J}% relevant to the job, so J = {J}.</li>
          <li><span className="font-semibold">Q, Evidence quality:</span> 5 bullets. 0.40 x directness 0.80 + 0.35 x ownership 0.92 + 0.25 x verifiable 0.90 = <span className="font-mono">{f1(Q)}</span>.</li>
          <li><span className="font-semibold">A, Education:</span> the degree is verified, so A = {A}.</li>
          <li><span className="font-semibold">E, Experience:</span> not scored (years not entered), so its 15% weight is shared among the others. The weights used add up to {WSUM}.</li>
        </ul>
      </div>

      {/* Step 3 */}
      <div className={box}>
        <p className="text-sm font-bold text-[#141A16]">Step 3 · Mix them by weight (Standard profile)</p>
        <div className="mt-2 rounded-xl bg-[#FAF9F5] border border-[#ECE7DD] p-4 space-y-1">
          <p className={mono}>({f1(before.K)} x {W.K}) + ({J} x {W.J}) + ({f1(Q)} x {W.Q}) + ({A} x {W.A})</p>
          <p className={mono}>= {f1(before.sum)} / {WSUM} = {f2(before.total)}</p>
        </div>
        <p className="text-sm font-bold text-[#1E6B38] mt-3">Score = {Math.round(before.total)} / 100</p>
      </div>

      {/* How it increases */}
      <div className={`${box} bg-[#EAF4EB] border-[#C5E1CB]`}>
        <p className="text-sm font-bold text-[#141A16]">How the score goes up</p>
        <p className={`${muted} mt-1`}>The only missing required skill is Kubernetes. Here is what happens when the student fixes that:</p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            { t: "Now", v: before, note: "Kubernetes is missing (0).", extra: "" },
            { t: "Declare Kubernetes", v: declared, note: "Self-declared counts 0.5.", extra: "Required = (1+1+1+1+0.5)/5 = 90" },
            { t: "Prove it with a project", v: proven, note: "Real evidence counts 1.0.", extra: "Required = (1+1+1+1+1)/5 = 100" },
          ].map((s, i) => (
            <div key={s.t} className="rounded-xl bg-white border border-[#C5E1CB] p-4 space-y-1">
              <p className="text-xs font-bold text-[#1E6B38] uppercase tracking-wider">{s.t}</p>
              <p className="text-3xl font-serif text-[#141A16]">{Math.round(s.v.total)}</p>
              <p className="text-[11px] text-[#556056]">{s.note}</p>
              {s.extra && <p className="text-[11px] font-mono text-[#556056]">{s.extra}</p>}
              <p className="text-[11px] font-mono text-[#556056]">K = {f1(s.v.K)}, total {f2(s.v.total)}</p>
              {i > 0 && <p className="text-xs font-bold text-[#1E6B38]">+{Math.round(s.v.total) - Math.round(before.total)} points</p>}
            </div>
          ))}
        </div>

        <ul className={`${muted} mt-4 space-y-1.5 list-disc pl-4`}>
          <li>Only <span className="font-semibold">K</span> changed. The rise is its change times its weight: (K up by {f1(declared.K - before.K)}) x 40 / 85 = about +{f1(declared.total - before.total)} points.</li>
          <li>Proving a skill is worth about twice as much as declaring it, because a real project counts 1.0 and a declaration counts 0.5.</li>
          <li>Adding a bullet does not change K. A bullet only changes Evidence quality, which has the smallest weight (10 out of 85).</li>
        </ul>
      </div>
    </div>
  );
}
