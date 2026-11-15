"""Application services: ledger ops, ingestion, and the per-job pipeline (Phase 1 + Phase 2)."""
import math
import re
import time
from datetime import datetime

from sqlalchemy.orm import Session

from . import activity
from . import orchestrator as orch
from .config import USE_LLM
from .db import Fact, Job, RunLog, Source, User, next_seq
from .engine.matching import fact_view, match_all, relevance_of_facts
from .engine.scoring import DEFAULT_PROFILE, all_profiles, profile_info, recommendations, resume_text, score
from .engine.verify import verify_bullet
from .parsers import check_input, sha
from .vocab import find_skills, norm, pretty


def log(db: Session, agent: str, started: float, note: str = "", uid: int | None = None) -> None:
    db.add(RunLog(user_id=uid, agent=agent, ms=int((time.time() - started) * 1000), note=note[:300]))
    db.commit()


# ------------------------------------------------------------------ views
def ago(dt: datetime) -> str:
    s = (datetime.utcnow() - dt).total_seconds()
    return "just now" if s < 60 else f"{int(s // 60)} min ago" if s < 3600 else f"{int(s // 3600)} h ago" if s < 86400 else f"{int(s // 86400)} d ago"


def source_view(s: Source) -> dict:
    return {"id": f"s{s.id}", "name": s.name, "type": s.type, "detail": s.detail, "facts": len(s.facts),
            "state": s.state, "updated": ago(s.updated)}


def fact_api(f: Fact) -> dict:
    v = fact_view(f)
    t = f.source.type if f.source else "note"
    v["sourceType"] = {"github": "github", "pdf": "pdf", "docx": "docx", "pptx": "docx"}.get(t, "note")
    v["declared"] = bool(f.declared)
    v["auto"] = bool(f.auto) and f.status == "verified"
    return v


def all_facts(db: Session, user_id: int, include_rejected: bool = False) -> list[Fact]:
    q = db.query(Fact).filter(Fact.user_id == user_id)
    if not include_rejected:
        q = q.filter(Fact.status != "rejected")
    return q.order_by(Fact.seq).all()


# ------------------------------------------------------------------ Phase 1: ingestion
def ingest_text(db: Session, user_id: int, *, name: str, stype: str, text: str, uri: str = "", detail: str = "") -> tuple[Source, dict]:
    """Add or update a source, extract facts (CrewAI Extractor), mark changed facts stale."""
    with activity.step(user_id, "Input checker", "Python · injection + PII scan") as s:
        warnings = check_input(text)
        s["note"] = f"{len(text):,} characters scanned"
    h = sha(text)
    src = db.query(Source).filter(Source.user_id == user_id, Source.name == name, Source.type == stype).first()
    updating = src is not None
    if src and src.content_hash == h:
        return src, {"warnings": warnings, "added": 0, "stale": 0, "mode": "cached", "unchanged": True}
    if not src:
        src = Source(user_id=user_id, name=name, type=stype, uri=uri)
        db.add(src)
    src.text, src.content_hash, src.detail, src.state, src.updated = text, h, detail or src.detail, "synced", datetime.utcnow()
    db.commit()

    stale = 0
    if updating:  # Phase 1 step 6: re-sync on change -> facts whose span vanished become stale
        compact = re.sub(r"\s+", " ", text).lower()
        for f in src.facts:
            if f.span and re.sub(r"\s+", " ", f.span).lower() not in compact and f.status != "rejected":
                f.status, stale = "stale", stale + 1

    t0 = time.time()
    cands, mode = orch.extract_facts(text, name, stype, user_id)
    log(db, "Source Extractor", t0, f"{name}: {len(cands)} candidate facts ({mode})", user_id)
    have = {norm(f.text) for f in src.facts}
    auto_on = bool(getattr(db.get(User, user_id), "auto_confirm", 1))
    added = 0
    for c in cands:
        if norm(c["text"]) in have:
            continue
        # review by exception: facts quoted from the user's own files are confirmed on arrival;
        # anything with a number/metric (the riskiest to get wrong) still waits for an explicit click
        risky = c["category"] == "metric" or (c["category"] != "education" and c["project"] != "Skills" and any(ch.isdigit() for ch in c["text"]))
        auto = auto_on and not risky
        db.add(Fact(user_id=user_id, seq=next_seq(db, user_id), source_id=src.id, text=c["text"], span=c["span"], project=c["project"], category=c["category"], kind=c.get("kind", "project"), status="verified" if auto else "pending", auto=1 if auto else 0))
        added += 1
    db.commit()
    db.refresh(src)
    return src, {"warnings": warnings, "added": added, "stale": stale, "mode": mode, "unchanged": False}


# ------------------------------------------------------------------ Phase 2: per-job pipeline
def select_projects(analysis: dict, matches: list[dict], facts: list[dict], previous: list[dict] | None = None) -> list[dict]:
    """Project Selector: task relevance (matched requirement weight), not just tech-stack overlap."""
    rel = relevance_of_facts(analysis["requirements"], matches, facts)
    groups: dict[str, list[dict]] = {}
    for f in facts:
        if f["status"] == "verified" and not f["declared"] and f["category"] != "education" and f.get("kind") not in ("education", "other") and f["project"] not in ("Skills", "Education"):
            groups.setdefault(f["project"], []).append(f)
    req_by_fact: dict[str, list[str]] = {}
    for m in matches:
        for fid in m["facts"]:
            req_by_fact.setdefault(fid, []).append(m["text"])
    out = []
    for i, (name, fs) in enumerate(sorted(groups.items())):
        s = sum(rel.get(f["id"], 0) for f in fs)
        relevance = round(100 * (1 - math.exp(-s / 5)))
        reqs = []
        for f in fs:
            for r in req_by_fact.get(f["id"], []):
                if r not in reqs:
                    reqs.append(r)
        reason = ("Supports: " + "; ".join(reqs[:3]) + ".") if reqs else "Low task relevance for this role."
        out.append({"id": f"P{i + 1}", "name": name, "kind": "role" if any(f.get("kind") == "role" for f in fs) else "project", "reason": reason, "relevance": relevance, "picked": False})
    out.sort(key=lambda p: -p["relevance"])
    # jobs/internships and projects are ranked separately: a resume keeps its relevant experience AND its best projects
    for kind, keep, floor in (("role", 2, 15), ("project", 3, 30)):
        for p in [x for x in out if x["kind"] == kind][:keep]:
            p["picked"] = p["relevance"] >= floor
    if previous:  # keep ONLY the user's manual overrides; automatic picks are recomputed (they must follow relevance)
        prev = {p["name"]: p["picked"] for p in previous if p.get("manual")}
        for p in out:
            if p["name"] in prev:
                p["picked"], p["manual"] = prev[p["name"]], True
    return out


def _bundles(fs: list[dict], max_bullets: int, per: int = 4) -> list[list[dict]]:
    """Split a project's best facts (most relevant first) into `max_bullets` bullets, as evenly as possible:
    6 facts -> 3+3, 3 facts -> 2+1, 2 facts -> 1+1. Each bullet is later elaborated by the Writer from only its own facts."""
    fs = fs[: max_bullets * per]
    n = len(fs)
    if n == 0:
        return []
    k = min(max_bullets, n)
    size, extra = divmod(n, k)
    out, i = [], 0
    for g in range(k):
        take = size + (1 if g < extra else 0)
        out.append(fs[i : i + take])
        i += take
    return out


def write_resume(db: Session, data: dict, facts: list[dict], use_llm: bool = True, uid: int | None = None) -> dict:
    """Resume Writer <-> Verifier loop (batched: one Writer call for all bullets). Returns {summary, bullets, skills, verifier_log}."""
    t0 = time.time()
    rel = relevance_of_facts(data["analysis"]["requirements"], data["matches"], facts)
    picked = [p["name"] for p in data["projects"] if p["picked"]]
    targets, order = [], []
    for rank, proj in enumerate(picked):
        fs = [f for f in facts if f["project"] == proj and f["status"] == "verified" and not f["declared"] and f["category"] != "education" and not f["text"].startswith("Built with ")]  # tech-line facts are for matching only
        fs.sort(key=lambda f: -rel.get(f["id"], 0))
        stack = [f for f in facts if f["project"] == proj and f["status"] == "verified" and f["text"].startswith("Built with ")]
        for bundle in _bundles(fs, 3 if fs and fs[0].get("kind") == "role" else 2):  # 2 elaborated points per project, 3 per job/internship
            first = bundle[0]
            targets.append({
                "id": first["id"], "ids": [f["id"] for f in bundle] + [s["id"] for s in stack[:1]], "project": proj, "kind": first.get("kind"),
                "text": " ".join(f["text"].rstrip(".") + "." for f in bundle),  # plain sentences if the Writer is unavailable
                "details": [f["text"] for f in bundle], "stack": stack[0]["text"].replace("Built with ", "") if stack else "",
            })
            order.append(proj)
    pool = [f for f in facts if f["status"] == "verified"]
    res = orch.write_resume_text(data["analysis"], targets, pool, use_llm=use_llm, uid=uid)
    bullets, vlog = [], []
    for i, (f, proj) in enumerate(zip(targets, order), 1):
        text, attempts, mode = res["bullets"][f["id"]]
        bullets.append({"id": f"B{i}", "project": proj, "kind": "role" if f.get("kind") == "role" else "project", "text": text, "facts": f["ids"], "verified": True})
        vlog.append({"bullet": f"B{i}", "attempts": attempts, "mode": mode})
    # Skills section (ATS engines read it): verified skills from the ledger + self-declared ones, job-relevant first
    jd_sk = set(data["analysis"]["keywords"])
    items: list[tuple[int, str]] = []
    for f in facts:
        if f["status"] == "verified" and (f["declared"] or f["project"] == "Skills"):
            label = f["span"] or f["text"].replace("Skilled in ", "")
            items.append((0 if find_skills(label) & jd_sk else 1, label))
    skills = list(dict.fromkeys(label for _, label in sorted(items, key=lambda x: x[0])))[:24]
    log(db, "Resume Writer + Verifier", t0, f"{len(bullets)} bullets, {sum(v['attempts'] > 1 for v in vlog)} revised by Verifier", uid)
    return {"summary": res["summary"], "bullets": bullets,
            "skills": skills, "verifier_log": vlog}


def keyword_coach(data: dict, facts: list[dict], use_llm: bool = True) -> list[dict]:
    """Grounded rewrite when a fact supports a missing keyword; otherwise an honest gap."""
    rtxt = resume_text(data["resume"])
    have = find_skills(rtxt)
    used = {i for b in data["resume"]["bullets"] for i in b["facts"]}
    out = []
    for kw in data["analysis"]["keywords"]:
        if kw in have or norm(kw) in norm(rtxt):
            continue
        cand = [f for f in facts if f["status"] == "verified" and not f["declared"] and kw in find_skills(f["text"] + " " + f["span"])]
        cand.sort(key=lambda f: f["id"] in used)
        k = {"id": f"K{len(out) + 1}", "word": pretty(kw), "canon": kw, "state": "gap", "note": f"No verified fact supports {pretty(kw)}. SkillOra will not invent it - add a source or self-declare the skill."}
        if cand:
            f = cand[0]
            k.update(state="suggested", fact=f["id"], rewrite=f["text"], note=f"Grounded in {f['id']} ({f['source']}).")
        out.append(k)
    return out


def build_job(db: Session, user_id: int, jd_text: str) -> Job:
    check_input(jd_text, kind="job description")
    facts = [fact_view(f) for f in all_facts(db, user_id)]
    t0 = time.time()
    analysis, matches, mode = orch.analyze_and_match(jd_text, facts, user_id)
    log(db, "JD Analyzer + Matcher", t0, f"{len(analysis['requirements'])} requirements, {sum(m['match'] == 'met' for m in matches)} met ({mode})", user_id)
    data = {"analysis": analysis, "matches": matches, "mode": mode}
    with activity.step(user_id, "Project Selector", "Python · task relevance") as s:
        data["projects"] = select_projects(analysis, matches, facts)
        s["note"] = f"{sum(p['picked'] for p in data['projects'])} of {len(data['projects'])} projects/roles selected"
    data["resume"] = write_resume(db, data, facts, use_llm=USE_LLM, uid=user_id)
    with activity.step(user_id, "Keyword Coach", "Python · fact ledger") as s:
        data["keywords"] = keyword_coach(data, facts)
        s["note"] = f"{sum(k['state'] == 'suggested' for k in data['keywords'])} grounded rewrites, {sum(k['state'] == 'gap' for k in data['keywords'])} real gaps"
    with activity.step(user_id, "Scoring Engine", "Python · deterministic, no LLM") as s:
        s["note"] = f"{score(data['analysis'], data['matches'], facts, data['resume'], data['projects'], DEFAULT_PROFILE, getattr(db.get(User, user_id), 'experience_years', None))['total']}/100 (same input = same score)"
    data["sig"] = facts_sig(facts)
    data["sel_v"] = 2
    data["chat"] = [{"from": "agent", "text": f"I analysed the job and selected {sum(p['picked'] for p in data['projects'])} projects. Ask me to change anything."}]
    job = Job(user_id=user_id, title=analysis["title"], company=analysis["company"], jd_text=jd_text, data=data)
    db.add(job)
    db.commit()
    return job


def refresh_job(db: Session, job: Job, *, rewrite: bool = True, use_llm: bool = False) -> Job:
    """Re-run matching/selection (after fact edits) and optionally the writer."""
    facts = [fact_view(f) for f in all_facts(db, job.user_id)]
    d = dict(job.data)
    d["matches"] = match_all(d["analysis"]["requirements"], facts)
    d["projects"] = select_projects(d["analysis"], d["matches"], facts, d["projects"])
    if rewrite:
        d["history"] = (list(d.get("history", [])) + [d["resume"]])[-10:]  # agents rewriting can be undone too
        d["resume"] = write_resume(db, d, facts, use_llm=use_llm, uid=job.user_id)
        d["keywords"] = keyword_coach(d, facts)
    job.data = d
    db.commit()
    return job


def facts_sig(facts: list[dict]) -> str:
    return sha("|".join(f"{f['id']}:{f['status']}:{f['text']}" for f in facts))


def job_view(db: Session, job: Job) -> dict:
    facts = [fact_view(f) for f in all_facts(db, job.user_id)]
    if job.data.get("sig") != facts_sig(facts) or job.data.get("sel_v") != 2:  # ledger changed (or older selection rules) -> deterministic re-match + re-select (no LLM)
        refresh_job(db, job, rewrite=False)
        d = dict(job.data)
        d["sig"] = facts_sig(facts)
        d["sel_v"] = 2
        job.data = d
        db.commit()
    d = job.data
    # live re-verification: edited bullets / changed fact statuses are re-checked on every read
    by_id = {f["id"]: f for f in facts}
    for b in d["resume"]["bullets"]:
        v = verify_bullet(b["text"], b["facts"], by_id)
        b["verified"], b["issues"] = v["ok"], v["issues"]
        b["kind"] = b.get("kind") or ("role" if by_id.get((b["facts"] or [""])[0], {}).get("kind") == "role" else "project")
    prof_id = profile_info(d.get("profile", DEFAULT_PROFILE))["id"]
    years = getattr(db.get(User, job.user_id), "experience_years", None)
    sc = score(d["analysis"], d["matches"], facts, d["resume"], d["projects"], prof_id, years)
    recs = recommendations(d["analysis"], facts, d["resume"], d["projects"], d["keywords"], sc, prof_id, years, d["matches"])
    a = d["analysis"]
    return {
        "id": job.id,
        "meta": {"title": a["title"], "company": a["company"], "seniority": a["seniority"], "keywords": [pretty(k) for k in a["keywords"]]},
        "jd": job.jd_text,
        "requirements": d["matches"],
        "projects": d["projects"],
        "resume": d["resume"],
        "keywords": d["keywords"],
        "chat": d.get("chat", []),
        "score": sc,
        "recommendations": recs,
        "profile": sc["profile"],
        "profiles": all_profiles(),
        "eligibility": sc["eligibility"],
        "mode": d.get("mode", "rules"),
    }


def profile(user: User) -> dict:
    return {"name": user.name or "Your Name", "email": user.email, "links": user.links, "location": user.location, "phone": getattr(user, "phone", "") or "", "auto_confirm": bool(user.auto_confirm), "education": user.education or "", "experience_years": user.experience_years}

