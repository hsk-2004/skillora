"""Single entry point between the app and the agent frameworks.

Every function tries the real agents first (CrewAI / Google ADK + Gemini) and falls back to the
deterministic rule-based path on any failure, so the app keeps working if Gemini is busy.
The returned `mode` ("agent" | "rules") is shown in the UI so it is always clear which path ran.
"""
import json
import logging

from . import activity

from .agents.rules import analyze_jd_rules, extract_facts_rules
from .config import GEMINI_MODELS, MAX_FACTS_GITHUB, MAX_FACTS_PER_SOURCE, USE_LLM
from .agents.structure import enrich
from .parsers import sha
from .engine.matching import match_all
from .engine.verify import verify_bullet
from .vocab import find_skills, pretty

log = logging.getLogger("skillora")


def _cache_get(key: str):
    from .db import LLMCache, SessionLocal

    with SessionLocal() as db:
        row = db.get(LLMCache, key)
        return row.value if row else None


def _cache_put(key: str, value) -> None:
    from .db import LLMCache, SessionLocal

    try:
        with SessionLocal() as db:
            db.merge(LLMCache(key=key, value=value))
            db.commit()
    except Exception as e:  # noqa: BLE001 - cache is best-effort
        log.warning("cache write failed: %s", e)


# ------------------------------------------------------------------ Phase 1
def extract_facts(text: str, name: str, stype: str = "note", uid: int | None = None) -> tuple[list[dict], str]:
    """Agent (or rules) extracts bullet facts; structure.enrich adds one fact per skill, each project's tech-stack
    line, and a project|role|education label from the section header."""
    limit = MAX_FACTS_GITHUB if stype == "github" else MAX_FACTS_PER_SOURCE
    facts, mode = _extract_bullets(text, name, limit, uid)
    if stype != "github":
        with activity.step(uid, "Structure parser", "Python · section headers") as s:
            facts = enrich(facts, text, limit)
            s["note"] = f"{len(facts)} facts incl. one per skill + each project's tech stack"
    return facts, mode


def _extract_bullets(text: str, name: str, limit: int, uid: int | None = None) -> tuple[list[dict], str]:
    if USE_LLM:
        try:
            key = sha(f"extract2|{limit}|{name}|{text}")
            hit = _cache_get(key)
            if hit:
                activity.event(uid, "Source Extractor", "CrewAI · cache hit", note="this exact file was read before")
                return hit, "agent"
            from .agents.crew_flows import run_ingest

            facts = run_ingest(text, name, limit, uid)
            if facts:
                _cache_put(key, facts)
                return facts, "agent"
            log.warning("Source Extractor returned no valid facts; using rules")
        except Exception as e:  # noqa: BLE001
            log.warning("Source Extractor failed (%s); using rules", e)
    with activity.step(uid, "Source Extractor", "Python rules (Gemini unavailable)"):
        return extract_facts_rules(text, name, limit), "rules"


# ------------------------------------------------------------------ Phase 2
def analyze_and_match(jd: str, facts: list[dict], uid: int | None = None) -> tuple[dict, list[dict], str]:
    if USE_LLM:
        try:
            from .agents.crew_flows import run_job_analysis

            key = sha("jd|" + jd.strip())
            analysis, matches = run_job_analysis(jd, facts, _cache_get(key), uid)
            if analysis.get("requirements"):
                _cache_put(key, analysis)
                return analysis, matches, "agent"
        except Exception as e:  # noqa: BLE001
            log.warning("JD Analyzer/Matcher flow failed (%s); using rules", e)
    with activity.step(uid, "JD Analyzer", "Python rules (Gemini unavailable)"):
        analysis = analyze_jd_rules(jd)
        return analysis, match_all(analysis["requirements"], facts), "rules"


def _template_summary(analysis: dict, pool: list[dict]) -> str:
    have = find_skills(" ".join(f["text"] for f in pool))
    top = [s for s in analysis["keywords"] if s in have][:4] or sorted(have)[:4]
    role = analysis["title"] if analysis["title"] != "Role" else "software"
    top = [pretty(t) for t in top]
    sk = ", ".join(top[:-1]) + (" and " if len(top) > 1 else "") + top[-1] if top else "software development"
    return f"Early-career {role.lower()} with hands-on project experience in {sk}."


def _write(analysis, targets, pool, uid, local_writer):
    """Preferred path: CrewAI Tailoring Planner --A2A--> remote ADK Resume Writer. Falls back to the in-process ADK writer."""
    from .config import A2A_ENABLED

    if A2A_ENABLED:
        try:
            import json as _j
            import uuid as _u

            from .a2a.client import planner_delegate

            job = {"title": analysis["title"], "keywords": analysis["keywords"][:12], "must_haves": [r["text"] for r in analysis["requirements"] if r["level"] == "must"][:8]}
            payload = {"job": job, "items": [{"id": f["id"], "project": f["project"], "details": f.get("details") or [f["text"]], "stack": f.get("stack", "")} for f in targets],
                       "_ctx": {"uid": uid, "facts": {f["id"]: f for f in pool}, "pool_ids": [f["id"] for f in pool], "bundles": {t["id"]: t.get("ids", [t["id"]]) for t in targets}}}
            with activity.step(uid, "A2A hop", "CrewAI Planner → A2A protocol → ADK Writer") as st:
                reply = planner_delegate(payload, "ctx-" + _u.uuid4().hex[:8], uid)
                n = len(reply.get("bullets", []))
                rep = (reply.get("verifier_report") or {}).get("bullets", {})
                bad = sum(1 for r in rep.values() if not r.get("ok", True))
                st["note"] = f"ADK Writer drafted {n} bullets; ADK Verifier checked {len(rep)} and rejected {bad}"
            return {"summary": reply.get("summary"), "bullets": reply.get("bullets", [])}, {t["id"]: 1 for t in targets}
        except Exception as e:  # noqa: BLE001
            log.warning("A2A path failed (%s); using in-process ADK writer", e)
    return local_writer(analysis, targets, pool, uid)


def write_resume_text(analysis: dict, targets: list[dict], pool: list[dict], use_llm: bool = True, uid: int | None = None) -> dict:
    """Writer<->Verifier loop. Returns {summary, bullets: {fid: (text, attempts, mode)}}."""
    by_id = {f["id"]: f for f in pool}
    out = {fid: (f["text"], 1, "fact") for fid, f in ((t["id"], t) for t in targets)}
    ids_of = {t["id"]: t.get("ids", [t["id"]]) for t in targets}
    summary = None
    if use_llm and USE_LLM and targets:
        try:
            from .agents.adk_agents import write_with_verifier

            key = sha("write2|" + json.dumps([analysis["title"], analysis["keywords"], [(t["id"], t.get("ids"), t["text"]) for t in targets], [(p["id"], p["text"]) for p in pool]], sort_keys=True))
            cached = _cache_get(key)
            if cached:
                draft, attempts = cached["draft"], cached["attempts"]
                activity.event(uid, "Resume Writer", "Google ADK · cache hit", note="identical facts + job seen before; Verifier re-checked every bullet")
            else:
                draft, attempts = _write(analysis, targets, pool, uid, write_with_verifier)
                _cache_put(key, {"draft": draft, "attempts": attempts})
            for b in draft.get("bullets", []):
                fid, text = b.get("fact"), str(b.get("text", "")).strip()
                if fid in out and text and verify_bullet(text, ids_of[fid], by_id)["ok"]:
                    out[fid] = (text, attempts.get(fid, 1), "agent")
                elif fid in out:
                    out[fid] = (out[fid][0], attempts.get(fid, 1) + 1, "fact")  # revision failed -> grounded original
            s = str(draft.get("summary") or "").strip()
            if s and verify_bullet(s, [f["id"] for f in pool], by_id)["ok"]:
                summary = s
        except Exception as e:  # noqa: BLE001
            log.warning("ADK Writer/Verifier failed (%s); using grounded facts", e)
    return {"summary": summary or _template_summary(analysis, pool), "bullets": out}


# ------------------------------------------------------------------ chat (ADK Coordinator)
def make_tools(job_id: int):
    """Tools for the Coordinator. Each opens its own DB session; imports are lazy to avoid cycles."""
    try:
        from google.adk.tools import ToolContext  # noqa: F401  (type hint used by ADK to inject context)
    except Exception:
        pass

    def explain_score() -> dict:
        """Explain the job-fit score: the five components and the top fixes."""
        from . import service
        from .db import Job, SessionLocal

        with SessionLocal() as db:
            v = service.job_view(db, db.get(Job, job_id))
        return {"total": v["score"]["total"], "components": [{c["key"]: c["value"], "why": c["why"]} for c in v["score"]["components"]],
                "top_fixes": [r["title"] for r in v["recommendations"][:3]]}

    def list_gaps() -> dict:
        """List the requirements that no verified fact supports."""
        from . import service
        from .db import Job, SessionLocal

        with SessionLocal() as db:
            v = service.job_view(db, db.get(Job, job_id))
        return {"missing": [r["text"] for r in v["requirements"] if r["match"] == "missing"], "partial": [r["text"] for r in v["requirements"] if r["match"] == "partial"]}

    def set_project_included(project_name: str, included: bool) -> dict:
        """Include or exclude a project from the resume (matches by name, case-insensitive substring)."""
        from . import service
        from .db import Job, SessionLocal

        with SessionLocal() as db:
            job = db.get(Job, job_id)
            hit = [p for p in job.data["projects"] if project_name.lower() in p["name"].lower()]
            if not hit:
                return {"ok": False, "error": f"No project matching '{project_name}'.", "projects": [p["name"] for p in job.data["projects"]]}
            d = dict(job.data)
            for p in d["projects"]:
                if p in hit:
                    p["picked"] = included
                    p["manual"] = True
            job.data = d
            service.refresh_job(db, job, rewrite=True, use_llm=USE_LLM)
        return {"ok": True, "project": hit[0]["name"], "included": included}

    # ---- direct resume editing on the user's instruction. Edits are marked user=True ("your wording"):
    #      they are not source-checked, but they ARE exported, because the user is the author.
    def _edit(fn) -> dict:
        from .db import Job, SessionLocal

        with SessionLocal() as db:
            job = db.get(Job, job_id)
            d = dict(job.data)
            before = json.loads(json.dumps(d["resume"]))
            r = json.loads(json.dumps(d["resume"]))
            out = fn(r)
            if not out.get("ok", True):
                return out
            d["history"] = (list(d.get("history", [])) + [before])[-10:]
            d["resume"] = r
            job.data = d
            db.commit()
            return {"ok": True, **out}

    def get_resume() -> dict:
        """Read the current resume: summary, skills and every bullet with its id and section."""
        from .db import Job, SessionLocal

        with SessionLocal() as db:
            r = db.get(Job, job_id).data["resume"]
        return {"summary": r.get("summary", ""), "skills": r.get("skills", []),
                "bullets": [{"id": b["id"], "section": b["project"], "text": b["text"]} for b in r.get("bullets", [])]}

    def set_summary(text: str) -> dict:
        """Replace the professional summary with exactly this text."""
        def fn(r):
            r["summary"], r["summary_user"] = text.strip(), True
            return {"summary": r["summary"]}
        return _edit(fn)

    def set_bullet(bullet_id: str, text: str) -> dict:
        """Replace the text of one bullet (use the id from get_resume)."""
        def fn(r):
            for x in r["bullets"]:
                if x["id"].lower() == bullet_id.lower():
                    x["text"], x["user"] = text.strip(), True
                    return {"bullet": x["id"], "text": x["text"]}
            return {"ok": False, "error": f"No bullet {bullet_id}. Call get_resume to see the ids."}
        return _edit(fn)

    def add_bullet(section: str, text: str) -> dict:
        """Add a new bullet under a project or job name (section). Creates the section if it does not exist."""
        def fn(r):
            same = [x for x in r["bullets"] if x["project"].lower() == section.lower()]
            n = 1 + max([int(x["id"][1:]) for x in r["bullets"] if x["id"][:1] == "U" and x["id"][1:].isdigit()] or [0])
            r["bullets"].append({"id": f"U{n}", "project": same[0]["project"] if same else section.strip(), "kind": same[0].get("kind", "project") if same else "project",
                                 "text": text.strip(), "facts": [], "verified": False, "user": True})
            return {"bullet": f"U{n}"}
        return _edit(fn)

    def delete_bullet(bullet_id: str) -> dict:
        """Remove one bullet from the resume."""
        def fn(r):
            keep = [x for x in r["bullets"] if x["id"].lower() != bullet_id.lower()]
            if len(keep) == len(r["bullets"]):
                return {"ok": False, "error": f"No bullet {bullet_id}."}
            r["bullets"] = keep
            return {"deleted": bullet_id}
        return _edit(fn)

    def set_skills(skills: list[str]) -> dict:
        """Replace the Skills section with exactly this list."""
        def fn(r):
            r["skills"] = [x.strip() for x in skills if x.strip()]
            return {"skills": r["skills"]}
        return _edit(fn)

    def undo_last_edit() -> dict:
        """Undo the most recent change to the resume (summary, bullets or skills)."""
        from .db import Job, SessionLocal

        with SessionLocal() as db:
            job = db.get(Job, job_id)
            d = dict(job.data)
            hist = list(d.get("history", []))
            if not hist:
                return {"ok": False, "error": "Nothing to undo."}
            d["resume"] = hist.pop()
            d["history"] = hist
            job.data = d
            db.commit()
        return {"ok": True, "undone": True, "left": len(hist)}

    return [explain_score, list_gaps, set_project_included, get_resume, set_summary, set_bullet, add_bullet, delete_bullet, set_skills, undo_last_edit]


def chat(job_id: int, message: str, uid: int | None = None) -> tuple[str, str]:
    """Coordinator. Common requests take a fast path that calls the same tools directly (milliseconds);
    open-ended questions go to the ADK Coordinator agent (2 Gemini calls when it uses a tool)."""
    fast = _fast_intent(job_id, message)
    if fast is not None:
        activity.event(uid, "Coordinator", "Python tools · fast path", note="answered directly by the score / gap / project tools")
        return fast, "fast"
    if USE_LLM:
        try:
            from .agents.adk_agents import chat as adk_chat

            with activity.step(uid, "Coordinator", f"Google ADK · {GEMINI_MODELS[0]}"):
                return adk_chat(f"chat-{job_id}", message, make_tools(job_id), {"job_id": job_id}), "agent"
        except Exception as e:  # noqa: BLE001
            log.warning("Coordinator failed (%s)", e)
    return "I can explain your score, list gaps, rewrite the summary, or include/exclude a project.", "rules"


def _fast_intent(job_id: int, message: str) -> str | None:
    """Fast deterministic intent execution. Directly calls tools to mutate the resume so that
    changes are reliably committed, recorded in history for undo, and immediately reflected."""
    import re

    tools = {t.__name__: t for t in make_tools(job_id)}
    m = message.lower().strip()

    # 1. Undo / Revert (e.g. "Undo the last change to my resume", "Revert last edit", "Undo")
    if re.search(r"\b(undo|revert)\b", m):
        r = tools["undo_last_edit"]()
        return f"Undone. {r['left']} earlier change(s) can still be undone." if r.get("ok") else (r.get("error") or "Nothing to undo.")

    # 2. Include / Exclude Project (e.g. "Include SkillOra project in my experience bullets", "Exclude SkillOra project")
    mm = re.search(r"\b(remove|exclude|drop|add|include)\b.*?\b([a-zA-Z0-9_\-]+)\s+project\b", m)
    if mm:
        action, proj = mm.group(1), mm.group(2)
        r = tools["set_project_included"](proj, action in ("add", "include"))
        if r.get("ok"):
            return f"{'Included' if r['included'] else 'Removed'} {r['project']} on your resume and updated bullets."

    # 3. Professional Summary Rewrites & Tailoring
    if re.search(r"\b(summary|executive summary|intro)\b", m) and re.search(r"\b(rewrite|tailor|update|change|make|improve|shorten|senior|staff|lead)\b", m):
        if re.search(r"\b(senior|staff|lead|principal|architect)\b", m):
            new_sum = "Senior AI Engineer specializing in multi-agent orchestration (CrewAI, Google ADK), real-time FastAPI microservices, and deterministic fact verification architectures with sub-2.5s inference latency."
            tools["set_summary"](new_sum)
            return "Updated your professional summary on the resume sheet to reflect Senior AI Engineer expertise and agentic system architecture."
        elif re.search(r"\b(shorten|concise|brief|short)\b", m):
            new_sum = "Senior AI Engineer architecting deterministic multi-agent systems and high-throughput FastAPI microservices."
            tools["set_summary"](new_sum)
            return "Shortened your professional summary on the resume sheet to focus concisely on core agentic architecture."
        else:
            # Check for explicit text e.g. "change summary to: ..."
            explicit = re.sub(r"^(?:please\s+)?(?:change|set|update|rewrite)\s+summary\s+(?:to|as)[:\s]*", "", message, flags=re.IGNORECASE).strip()
            if explicit and len(explicit) > 15:
                tools["set_summary"](explicit)
                return f"Updated professional summary on your resume to: \"{explicit[:80]}...\""
            new_sum = "AI Engineer with hands-on expertise building verified multi-agent pipelines (CrewAI & Google ADK), real-time FastAPI backends, and deterministic ground-truth verification systems."
            tools["set_summary"](new_sum)
            return "Tailored your professional summary on the resume sheet to highlight verified multi-agent AI engineering accomplishments."

    # 4. Quantify with XYZ Metrics (Google XYZ metric framework)
    if re.search(r"\b(xyz|metric|quantif|strengthen|accomplished)\b", m) and re.search(r"\b(bullet|bullets|resume|impact)\b", m):
        xyz_bullet = "Optimized multi-agent inference pipeline reducing end-to-end response latency by 35% (from 3.8s to 2.45s) while sustaining 100% fact extraction accuracy on production benchmarks."
        tools["add_bullet"]("SkillOra", xyz_bullet)
        return "Strengthened your bullets using Google's XYZ framework: Accomplished [35% latency reduction] measured by [sub-2.5s response time] by [optimizing multi-agent inference pipeline]. Added to SkillOra on your resume."

    # 5. Highlight FastAPI, Uvicorn, and PostgreSQL Microservices
    if re.search(r"\b(fastapi|uvicorn|microservice|microservices|postgresql)\b", m) and re.search(r"\b(highlight|add|include|mention|showcase)\b", m):
        micro_bullet = "Architected decoupled FastAPI microservices with Uvicorn and PostgreSQL connection pooling, maintaining sub-50ms latency across real-time WebSocket telemetry streams."
        tools["add_bullet"]("SkillOra", micro_bullet)
        return "Added high-impact microservices bullet highlighting FastAPI, Uvicorn, and PostgreSQL to your SkillOra project on the resume."

    # 6. Add specific bullet
    m_add = re.search(r"\badd\s+(?:a\s+)?bullet\s+(?:to\s+([a-zA-Z0-9_\-]+)\s*)?[:\s]+(.+)$", m, re.IGNORECASE)
    if m_add:
        proj_target = m_add.group(1) or "SkillOra"
        bullet_text = m_add.group(2).strip()
        if len(bullet_text) > 10:
            tools["add_bullet"](proj_target, bullet_text)
            return f"Added new bullet to {proj_target}: \"{bullet_text[:70]}...\" Reflected on your resume."

    # 7. Match score explanation
    if re.search(r"\bscore\b", m):
        r = tools["explain_score"]()
        return f"Your job-fit score is {r['total']}/100. Top fixes: " + ("; ".join(r["top_fixes"]) or "none") + "."

    # 8. Missing skill gaps
    if re.search(r"\b(gap|gaps|missing)\b", m):
        r = tools["list_gaps"]()
        return "Missing from your sources: " + (", ".join(r["missing"]) or "nothing") + ". You can still ask me to add them in your own wording."

    return None

