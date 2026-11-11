"""CrewAI Flows - the deterministic analysis pipeline.

  IngestFlow        : Source Extractor agent  -> anti-fabrication span gate
  JobAnalysisFlow   : JD Analyzer agent -> Matcher (exact -> fuzzy -> embedding, LLM adjudicates borderline pairs)
"""
import json

from crewai import Agent, Crew, Process, Task
from crewai.flow.flow import Flow, listen, start
from pydantic import BaseModel

from .. import activity
from ..config import MAX_FACTS_PER_SOURCE
from ..engine.matching import match_all
from ..llm import crew_llm, parse_json, with_models
from ..vocab import find_skills
from ..core import audit, guardrail
from .rules import validate_facts


def _timed(uid, agent: str, tech: str, fn):
    """Run one agent call while the live-activity panel shows it as working."""
    with activity.step(uid, agent, tech):
        return fn()


def _run(model: str, role: str, goal: str, backstory: str, description: str, expected: str) -> str:
    agent = Agent(role=role, goal=goal, backstory=backstory, llm=crew_llm(model), allow_delegation=False, verbose=False)
    guardrail.check_input_text(description, where=f"CrewAI task · {role}")  # input guard: injection / toxicity
    task = Task(description=description, expected_output=expected, agent=agent,
                guardrail=guardrail.crew_json_guardrail("facts" if "facts" in expected else "requirements" if "requirements" in expected else "decisions") if ("JSON" in expected) else None,
                callback=lambda out: audit.record(None, "callback", f"CrewAI task_callback · {role}", f"task finished, {len(str(out.raw))} chars"))
    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False,
                step_callback=lambda step: audit.record(None, "callback", f"CrewAI step_callback · {role}", type(step).__name__))
    return str(crew.kickoff().raw)


# ------------------------------------------------------------------ Phase 1
class IngestState(BaseModel):
    text: str = ""
    name: str = ""
    limit: int = MAX_FACTS_PER_SOURCE
    uid: int | None = None
    raw: list[dict] = []
    facts: list[dict] = []


class IngestFlow(Flow[IngestState]):
    @start()
    def source_extractor(self):
        """Source Extractor agent: chunks -> candidate facts, each with a quoted source span."""
        text = self.state.text[:16000]
        desc = (
            f"Source: {self.state.name}\n\nExtract up to {self.state.limit} factual claims about the candidate's work "
            "(what they built or did, measurable results, education, certifications). Cover EVERY bullet point under projects and "
            "experience - one fact per bullet, do not skip or merge bullets. Do NOT extract the skills list or the technology line under "
            "a project heading (handled separately). Rules:\n"
            "- Every fact MUST include `span`: an EXACT, verbatim quote (one sentence or bullet) copied from the source.\n"
            "- `text` is a clean one-sentence restatement that adds NO information that is not in the span. "
            "Start it with a past-tense action verb (e.g. 'Built ...', 'Reduced ...'); never write 'The candidate', 'The chatbot' or any pronoun.\n"
            "- Never invent numbers, tools or outcomes.\n"
            "- `category` is one of: skill, metric, experience, education.\n"
            "- `project` is the project/role the fact belongs to.\n"
            'Return ONLY JSON: {"facts":[{"text":"","span":"","project":"","category":""}]}\n\nSOURCE TEXT:\n' + text
        )
        out = _timed(self.state.uid, "Source Extractor", "CrewAI Flow · Gemini", lambda: with_models(lambda m: _run(
            m, "Source Extractor", "Turn raw source material into verifiable, quoted facts",
            "You are meticulous. You only record what the source literally says and always quote it.",
            desc, "A JSON object with a `facts` array")))
        data = parse_json(out) or {}
        self.state.raw = data.get("facts", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
        return self.state.raw

    @listen(source_extractor)
    def span_gate(self, _):
        """Deterministic gate: drop any fact whose quoted span is not literally in the source."""
        with activity.step(self.state.uid, "Span gate", "Python · anti-fabrication check") as s:
            self.state.facts = validate_facts(self.state.raw, self.state.text, self.state.name, self.state.limit)
            s["note"] = f"{len(self.state.facts)} of {len(self.state.raw)} quotes found verbatim in the source"
        return self.state.facts


def run_ingest(text: str, name: str, limit: int = MAX_FACTS_PER_SOURCE, uid: int | None = None) -> list[dict]:
    flow = IngestFlow()
    flow.kickoff(inputs={"text": text, "name": name, "limit": limit, "uid": uid})
    return flow.state.facts


# ------------------------------------------------------------------ Phase 2
class JobState(BaseModel):
    uid: int | None = None
    jd: str = ""
    facts: list[dict] = []
    analysis: dict = {}
    matches: list[dict] = []


class JobAnalysisFlow(Flow[JobState]):
    @start()
    def jd_analyzer(self):
        if self.state.analysis:  # cached analysis for this exact JD: skip the LLM call
            activity.event(self.state.uid, "JD Analyzer", "CrewAI · cache hit", note="same job description analysed before")
            return self.state.analysis
        desc = (
            "Analyze this job description. Return ONLY JSON:\n"
            '{"title":"","company":"","seniority":"e.g. 0-2 years","requirements":[{"text":"","level":"must|nice",'
            '"category":"skill|experience|education|other","skills":["canonical tech names"]}]}\n'
            "Rules: 6-14 requirements, short (<=12 words each). `must` = required, `nice` = preferred/bonus. "
            "Use real tool/technology names in `skills` (e.g. Python, FastAPI, PostgreSQL, Docker). Do not invent requirements.\n\nJOB DESCRIPTION:\n"
            + self.state.jd[:6000]
        )
        out = _timed(self.state.uid, "JD Analyzer", "CrewAI Flow · Gemini", lambda: with_models(lambda m: _run(
            m, "JD Analyzer", "Turn a job description into structured, ATS-style requirements",
            "You are a recruiter who parses job descriptions into must-have and nice-to-have requirements.",
            desc, "A JSON object with title, company, seniority and requirements")))
        data = parse_json(out)
        if not isinstance(data, dict) or not data.get("requirements"):
            raise ValueError("JD Analyzer returned no requirements")
        reqs = []
        for r in data["requirements"][:20]:
            t = str(r.get("text", "")).strip()
            if not t:
                continue
            sk = sorted(set(find_skills(t)) | {s for s in find_skills(" ".join(map(str, r.get("skills", []))))})
            cat = r.get("category") if r.get("category") in {"skill", "experience", "education", "other"} else "skill"
            reqs.append({"id": f"R{len(reqs) + 1}", "text": t[:120], "level": "nice" if r.get("level") == "nice" else "must", "category": cat, "skills": sk})
        kws = sorted(find_skills(self.state.jd) | {s for r in reqs for s in r["skills"]})
        self.state.analysis = {"title": data.get("title") or "Role", "company": data.get("company") or "",
                               "seniority": data.get("seniority") or "not specified", "requirements": reqs, "skills": kws, "keywords": kws}
        return self.state.analysis

    @listen(jd_analyzer)
    def matcher(self, _):
        """Matcher agent: deterministic exact -> fuzzy -> embedding tiers, then the agent adjudicates borderline pairs."""
        with activity.step(self.state.uid, "Matcher", "CrewAI Flow · exact → fuzzy → embedding") as s:
            matches = match_all(self.state.analysis["requirements"], self.state.facts)
            s["note"] = f"{sum(m['match'] == 'met' for m in matches)} met, {sum(m['match'] == 'partial' for m in matches)} partial, {sum(m['match'] == 'missing' for m in matches)} missing"
        border = [m for m in matches if m["via"] in ("fuzzy", "embedding") and m["facts"]]
        if len(border) >= 3:  # an LLM call only pays off when several pairs are genuinely borderline
            fbyid = {f["id"]: f for f in self.state.facts}
            pairs = [{"req": m["id"], "requirement": m["text"], "fact": fbyid[m["facts"][0]]["text"]} for m in border[:10]]
            desc = ("For each pair decide whether the fact genuinely demonstrates the requirement. Return ONLY JSON: "
                    '{"decisions":[{"req":"R1","supports":true|false}]}\n\n' + json.dumps(pairs))
            try:
                out = _timed(self.state.uid, "Matcher agent", "CrewAI · Gemini adjudication", lambda: with_models(lambda mdl: _run(
                    mdl, "Matcher", "Decide if a candidate fact truly supports a job requirement",
                    "You are strict: related is not the same as supports.", desc, "JSON decisions")))
                dec = {d.get("req"): bool(d.get("supports")) for d in (parse_json(out) or {}).get("decisions", []) if isinstance(d, dict)}
                for m in matches:
                    if m["id"] in dec and not dec[m["id"]]:
                        m.update(match="missing", via="none", facts=[], confidence=0.0)
            except Exception:  # noqa: BLE001 - adjudication is an enhancement; keep deterministic result
                pass
        self.state.matches = matches
        return matches


def run_job_analysis(jd: str, facts: list[dict], cached: dict | None = None, uid: int | None = None) -> tuple[dict, list[dict]]:
    flow = JobAnalysisFlow()
    flow.kickoff(inputs={"jd": jd, "facts": facts, "analysis": cached or {}, "uid": uid})
    return flow.state.analysis, flow.state.matches
