"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";

/** Live resume page. Re-renders from the store, so every accept, edit or ADK chat change shows up immediately;
 *  a bullet that was just added or changed is highlighted for a few seconds. */
export default function ResumePreview() {
  const { profile, summary, bullets, skills } = useStore();
  const prev = useRef<Map<string, string>>(new Map());
  const first = useRef(true);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [summaryFresh, setSummaryFresh] = useState(false);
  const prevSummary = useRef(summary);
  // text being typed in the canvas right now, shown before it is saved (id "__summary" = the summary)
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const onDraft = (e: Event) => {
      const { id, text } = (e as CustomEvent).detail as { id: string; text: string };
      setDrafts((d) => ({ ...d, [id]: text }));
    };
    const onClear = (e: Event) => {
      const { id } = (e as CustomEvent).detail as { id: string };
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    };
    window.addEventListener("resume-draft", onDraft);
    window.addEventListener("resume-draft-clear", onClear);
    return () => {
      window.removeEventListener("resume-draft", onDraft);
      window.removeEventListener("resume-draft-clear", onClear);
    };
  }, []);

  useEffect(() => {
    const now = new Map(bullets.map((b) => [b.id, b.text]));
    if (first.current) {
      first.current = false; // nothing is "new" on the first paint
    } else {
      const changed = new Set<string>();
      now.forEach((t, id) => { if (prev.current.get(id) !== t) changed.add(id); });
      if (changed.size) {
        setFresh(changed);
        const t = setTimeout(() => setFresh(new Set()), 4000);
        prev.current = now;
        return () => clearTimeout(t);
      }
    }
    prev.current = now;
  }, [bullets]);

  useEffect(() => {
    if (prevSummary.current !== summary && summary) {
      setSummaryFresh(true);
      const t = setTimeout(() => setSummaryFresh(false), 4000);
      prevSummary.current = summary;
      return () => clearTimeout(t);
    }
    prevSummary.current = summary;
  }, [summary]);

  const groups = useMemo(() => {
    const build = (kind: "role" | "project") => {
      const m = new Map<string, typeof bullets>();
      bullets.filter((b) => (b.kind ?? "project") === kind).forEach((b) => m.set(b.project, [...(m.get(b.project) ?? []), b]));
      return Array.from(m.entries());
    };
    return { roles: build("role"), projects: build("project") };
  }, [bullets]);

  const contact = [profile.email, profile.phone, profile.location?.replace(/\s*\n\s*/g, ", "), profile.links].filter(Boolean).join("  ·  ");

  const Bullet = ({ b }: { b: (typeof bullets)[number] }) => (
    <li
      className={`pl-1 leading-snug transition-colors duration-700 rounded ${fresh.has(b.id) || b.id in drafts ? "bg-emerald-100" : b.verified === false ? "bg-amber-50" : ""}`}
      title={b.verified === false ? (b.issues?.[0] ?? "Not verified against your facts") : "Verified against your facts"}
    >
      {drafts[b.id] ?? b.text}
      {b.verified === false && !(b.id in drafts) && <span className="ml-1 text-[9px] font-bold text-amber-700">⚠ unverified</span>}
    </li>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-3.5">
      <h4 className="text-[10px] font-bold tracking-widest text-[#141A16] border-b border-[#141A16] pb-0.5 mb-1.5">{title}</h4>
      {children}
    </section>
  );

  return (
    <div className="bg-white border border-[#DDD7CA] rounded-md shadow-md p-6 text-[11px] text-[#1f2622] leading-relaxed font-serif">
      <h3 className="text-xl font-bold text-center tracking-wide">{profile.name || "Your Name"}</h3>
      {contact && <p className="text-center text-[10px] text-[#556056] mt-0.5">{contact}</p>}

      {summary || "__summary" in drafts ? (
        <Section title="SUMMARY">
          <p className={`rounded transition-colors duration-700 ${summaryFresh || "__summary" in drafts ? "bg-emerald-100" : ""}`}>{drafts["__summary"] ?? summary}</p>
        </Section>
      ) : null}

      {skills.length > 0 && (
        <Section title="SKILLS">
          <p>{skills.join(", ")}</p>
        </Section>
      )}

      {groups.roles.length > 0 && (
        <Section title="EXPERIENCE">
          {groups.roles.map(([name, bl]) => (
            <div key={name} className="mb-2">
              <p className="font-bold">{name}</p>
              <ul className="list-disc ml-4 space-y-0.5">{bl.map((b) => <Bullet key={b.id} b={b} />)}</ul>
            </div>
          ))}
        </Section>
      )}

      {groups.projects.length > 0 && (
        <Section title="PROJECTS">
          {groups.projects.map(([name, bl]) => (
            <div key={name} className="mb-2">
              <p className="font-bold">{name}</p>
              <ul className="list-disc ml-4 space-y-0.5">{bl.map((b) => <Bullet key={b.id} b={b} />)}</ul>
            </div>
          ))}
        </Section>
      )}

      {(profile.degree || profile.university || profile.education) && (
        <Section title="EDUCATION">
          <p>{profile.degree || profile.education}{profile.university ? `, ${profile.university}` : ""}{profile.cgpa ? ` · CGPA ${profile.cgpa}` : ""}</p>
        </Section>
      )}

      {bullets.length === 0 && !summary && (
        <p className="mt-4 text-center text-[#78827A] font-sans">No resume yet. Analyze a job first.</p>
      )}
    </div>
  );
}
