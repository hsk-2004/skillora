// Numbered section heading shared by the explainer pages (Tracing, Score Formula).
export default function SectionHeading({ n, id, title, sub }: { n: number; id: string; title: string; sub?: string }) {
  return (
    <div id={id} className="scroll-mt-24 flex items-start gap-3">
      <span className="w-8 h-8 rounded-full bg-[#1E6B38] text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <div>
        <h2 className="text-2xl font-serif text-[#141A16] tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-[#556056] leading-relaxed mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
