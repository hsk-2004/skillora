"""Scoring Engine - plain Python, deterministic (no LLM). Configurable, explainable job-fit score.

An ATS-inspired model built from documented, general techniques (weighted skill matching, required vs preferred
criteria, evidence-based match values, eligibility kept separate from the score). It does NOT reproduce any
company's proprietary scoring, and the weights below are our own starting assumptions to be validated.

    S = wK*K + wJ*J + wE*E + wQ*Q + wA*A          (each component is 0-100; weights come from the chosen profile)

    K  skills match            weighted match of requirements, required vs preferred blended by `pref_share`
    J  responsibility fit      do your projects/roles show comparable work (not just the same tools)
    E  relevant experience     min(1, years you have / years the job asks for)  - only when both are known
    Q  evidence quality        0.40*directness + 0.35*ownership + 0.25*verifiability of your bullets
    A  education               match of education requirements (or credit for a verified degree)

If a component cannot be scored (e.g. years unknown) its weight is redistributed to the others and the report says so.
"""
import re

from ..vocab import find_skills, pretty
from .matching import match_all, match_requirement
from .verify import verify_bullet

PROFILES: dict[str, dict] = {
    "standard": {"label": "Standard", "desc": "Balanced default: skills carry the most weight.",
                 "weights": {"K": 40, "J": 25, "E": 15, "Q": 10, "A": 10}, "pref_share": 0.25},
    "skills_first": {"label": "Skills-first", "desc": "Hands-on technical roles: skills and project fit dominate.",
                     "weights": {"K": 50, "J": 25, "E": 10, "Q": 10, "A": 5}, "pref_share": 0.25},
    "credentials_first": {"label": "Credentials-first", "desc": "Gives education and qualifications more weight.",
                          "weights": {"K": 30, "J": 20, "E": 15, "Q": 10, "A": 25}, "pref_share": 0.25},
    "graduate": {"label": "Graduate / entry-level", "desc": "No years-of-experience requirement: projects, evidence and education matter most.",
                 "weights": {"K": 35, "J": 30, "E": 0, "Q": 20, "A": 15}, "pref_share": 0.30},
}
DEFAULT_PROFILE = "standard"
NAMES = {"K": "Skills match", "J": "Responsibility relevance", "E": "Relevant experience", "Q": "Evidence quality", "A": "Education"}
COLORS = {"K": "var(--c-green)", "J": "var(--c-blue)", "E": "var(--c-violet)", "Q": "var(--c-amber)", "A": "var(--c-rose)"}
MUST_W, NICE_W = 3, 1  # importance of required vs preferred items inside a group

STRONG = re.compile(r"^(built|developed|designed|architected|implemented|engineered|led|created|launched|deployed|automated|optimi[sz]ed|reduced|improved|"
                    r"integrated|delivered|drove|shipped|migrated|authored|constructed|established|enabled|maintained|trained|analy[sz]ed|wrote|managed)\b", re.I)
WEAK = re.compile(r"^(worked on|helped|assisted|involved|participated|responsible for|exposure to|familiar)\b", re.I)


def resume_text(resume: dict) -> str:
    return " ".join([resume.get("summary", ""), ", ".join(resume.get("skills", []))] + [b["text"] for b in resume.get("bullets", [])])


def profile_info(pid: str) -> dict:
    p = PROFILES.get(pid) or PROFILES[DEFAULT_PROFILE]
    pid = pid if pid in PROFILES else DEFAULT_PROFILE
    return {"id": pid, "label": p["label"], "desc": p["desc"], "weights": p["weights"], "pref_share": p["pref_share"]}


def all_profiles() -> list[dict]:
    return [profile_info(k) for k in PROFILES]


def _clamp(x: float) -> int:
    return int(max(0, min(100, round(x))))


def _mvalue(m: dict, by_id: dict) -> float:
    """Evidence-based match value m_i in [0,1]: demonstrated in a project/role 1.0; only listed 0.7; related 0.5; none 0."""
    if m["match"] == "missing":
        return 0.0
    cited = [by_id[i] for i in m["facts"] if i in by_id]
    if cited and all(f["declared"] for f in cited):
        return 0.5  # self-declared, no source proof
    demonstrated = any(f["project"] != "Skills" and not f["declared"] and f["category"] != "education" for f in cited)
    if m["match"] == "partial":
        return 0.5
    return 1.0 if demonstrated or m["category"] == "education" else 0.7


def _wavg(items: list[tuple[float, float]]) -> float | None:
    tot = sum(w for w, _ in items)
    return 100 * sum(w * v for w, v in items) / tot if tot else None


def _years_needed(seniority: str) -> float | None:
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", seniority or "")]
    return min(nums) if nums else None  # "2-3 years" asks for 2; "0-2 years" is an entry-level role (0)


def score(analysis: dict, matches: list[dict], facts: list[dict], resume: dict, projects: list[dict],
          profile: str = DEFAULT_PROFILE, years: float | None = None) -> dict:
    prof = profile_info(profile)
    W, pref_share = prof["weights"], prof["pref_share"]
    by_id = {f["id"]: f for f in facts}
    ms = {m["id"]: m for m in matches}
    reqs = analysis["requirements"]
    lvl = lambda r: MUST_W if r["level"] == "must" else NICE_W  # noqa: E731

    # ---- K: skills match = pref_share-blended required / preferred weighted match
    skill_reqs = [r for r in reqs if r["category"] != "education" and r["id"] in ms]
    req_items = [(1, _mvalue(ms[r["id"]], by_id)) for r in skill_reqs if r["level"] == "must"]
    pref_items = [(1, _mvalue(ms[r["id"]], by_id)) for r in skill_reqs if r["level"] != "must"]
    kr, kp = _wavg(req_items), _wavg(pref_items)
    K = kr if kp is None else kp if kr is None else (1 - pref_share) * kr + pref_share * kp
    K = 0.0 if K is None else K
    n_ev = sum(1 for _, v in req_items if v > 0)
    k_why = (f"Required {round(kr)} ({n_ev} of {len(req_items)} evidenced)" if kr is not None else "No required skills stated") + \
            (f"; preferred {round(kp)}" if kp is not None else "") + \
            (f"; blended {round((1 - pref_share) * 100)}/{round(pref_share * 100)}." if kr is not None and kp is not None else ".")

    # ---- J: responsibility fit = how well duty-type requirements are evidenced + best selected project's relevance
    duty = [r for r in reqs if r["category"] in ("experience", "other") and r["id"] in ms]
    resp = _wavg([(lvl(r), _mvalue(ms[r["id"]], by_id)) for r in duty])
    picked = [p for p in projects if p.get("picked")]
    best = max((p["relevance"] for p in picked), default=0)
    J = best if resp is None else 0.6 * resp + 0.4 * best
    j_why = (f"{len(duty)} responsibilities: {round(resp)} evidenced; " if resp is not None else "") + f"best selected project relevance {best} ({len(picked)} selected)."

    # ---- E: experience sufficiency (only when years are known and the job states what it needs)
    need = _years_needed(analysis.get("seniority", ""))
    if W.get("E", 0) == 0:
        E, e_ok, e_why = 0.0, False, "Not scored in this profile (entry-level policy)."
    elif years is None:
        E, e_ok, e_why = 0.0, False, "Not scored: add your years of relevant experience in Add Sources > Your details."
    elif need is None:
        E, e_ok, e_why = 0.0, False, "Not scored: the job does not state a years-of-experience requirement."
    else:
        E, e_ok = (100.0 if need == 0 else 100 * min(1.0, years / need)), True
        e_why = f"{years:g} relevant {'year' if years == 1 else 'years'} vs {need:g} asked for."

    # ---- Q: evidence quality of the bullets: 0.40*directness + 0.35*ownership + 0.25*verifiability
    bl = resume.get("bullets", [])
    if bl:
        D = sum(1 for b in bl if find_skills(b["text"])) / len(bl)
        O = sum(1.0 if STRONG.match(b["text"]) else 0.0 if WEAK.match(b["text"]) else 0.6 for b in bl) / len(bl)
        V = sum((1.0 if (re.search(r"\d", b["text"]) or len(find_skills(b["text"])) >= 2) else 0.5) if b.get("verified") else 0.0 for b in bl) / len(bl)
    else:
        D = O = V = 0.0
    Q = 100 * (0.40 * D + 0.35 * O + 0.25 * V)
    pend = sum(1 for f in facts if f["status"] == "pending" and not f["declared"])
    q_why = f"{len(bl)} bullets: directness {round(D * 100)}, ownership {round(O * 100)}, verifiable {round(V * 100)}" + (f"; {pend} facts still unconfirmed." if pend else ".")

    # ---- A: education
    edu_reqs = [r for r in reqs if r["category"] == "education" and r["id"] in ms]
    if edu_reqs:
        A = _wavg([(lvl(r), _mvalue(ms[r["id"]], by_id)) for r in edu_reqs]) or 0.0
        a_why = f"{sum(ms[r['id']]['match'] == 'met' for r in edu_reqs)} of {len(edu_reqs)} education requirements met."
    elif any(f["category"] == "education" and f["status"] == "verified" for f in facts):
        A, a_why = 100.0, "No education requirement stated; verified education on file."
    else:
        A, a_why = 50.0, "No education requirement stated and no education fact found (neutral)."

    vals = {"K": (K, True, k_why), "J": (J, True, j_why), "E": (E, e_ok, e_why), "Q": (Q, True, q_why), "A": (A, True, a_why)}
    active = {k: W[k] for k in vals if W.get(k, 0) > 0 and vals[k][1]}
    wsum = sum(active.values()) or 1
    total = round(sum(vals[k][0] * w for k, w in active.items()) / wsum)  # weights of unscored parts are redistributed
    comps = []
    for k in ("K", "J", "E", "Q", "A"):
        v, ok, why = vals[k]
        comps.append({"key": NAMES[k], "value": _clamp(v) if ok else 0, "color": COLORS[k], "weight": round(100 * active[k] / wsum) if k in active else 0,
                      "why": why, "scored": k in active})

    # ---- eligibility: mandatory qualifications, kept separate from the score. "Not found" is not "not qualified".
    unclear = [r["text"] for r in edu_reqs if r["level"] == "must" and ms[r["id"]]["match"] == "missing"]
    missing_must = [r["text"] for r in skill_reqs if r["level"] == "must" and ms[r["id"]]["match"] == "missing"]
    elig = {"status": "needs_review" if unclear else "eligible", "items": unclear, "gaps": missing_must,
            "note": "Missing from your resume does not mean you lack it: add proof (a source) or confirm it." if (unclear or missing_must) else ""}
    return {"total": total, "components": comps, "missing_must": missing_must, "eligibility": elig, "profile": prof}


def _sim_total(analysis: dict, facts: list[dict], resume: dict, projects: list[dict], profile: str, years: float | None,
               matches: list[dict] | None = None, only_unmet: bool = False) -> int:
    """The REAL engine total for a hypothetical state: re-match the requirements against `facts`, then score. Used to price suggestions.
    `only_unmet` re-matches just the requirements that are not already met (a new declared skill cannot change a met one): same result, much faster."""
    if only_unmet and matches:
        by_id = {m["id"]: m for m in matches}
        ms = [by_id[r["id"]] if r["id"] in by_id and by_id[r["id"]]["match"] == "met" else match_requirement(r, facts) for r in analysis["requirements"]]
    else:
        ms = match_all(analysis["requirements"], facts)
    return score(analysis, ms, facts, resume, projects, profile, years)["total"]


def _sim_declared(facts: list[dict], n: int, skill: str) -> dict:
    """A self-declared skill fact exactly like POST /api/facts/declare creates (counts at lower weight, no source proof)."""
    base = dict(facts[0]) if facts else {"source": "self-declared"}
    base.update(id=f"SIM{n}", text=skill, span="", project="Skills", category="skill", status="verified", declared=True)
    return base


_REC_CACHE: dict[str, list[dict]] = {}  # pricing suggestions runs the engine many times, so remember the result until the state changes


def recommendations(analysis: dict, facts: list[dict], resume: dict, projects: list[dict], keywords: list[dict], base: dict,
                    profile: str = DEFAULT_PROFILE, years: float | None = None, matches: list[dict] | None = None) -> list[dict]:
    """Ranked top 5 suggestions. Every "+N pts" is the difference between two REAL engine runs (before and after the suggestion is applied),
    so it is exactly what the score will show after Accept. Suggestions that would not raise the score are not offered as actions."""
    import hashlib
    import json

    key = hashlib.sha1(json.dumps([base["total"], profile, years, [(f["id"], f["status"], f["text"], bool(f.get("declared"))) for f in facts],
                                   [(b["text"], bool(b.get("verified"))) for b in resume.get("bullets", [])], [(k.get("id"), k.get("state")) for k in keywords],
                                   [r["id"] for r in analysis["requirements"]]], default=str).encode()).hexdigest()
    if key in _REC_CACHE:
        return _REC_CACHE[key]
    by_id = {f["id"]: f for f in facts}
    cur = base["total"]
    acts: list[dict] = []  # actionable: positive simulated gain
    used_skills: set[str] = set()

    # 1. Declare a missing skill (honest quick lever: counts at half weight, labelled self-declared). Covers missing must-haves and keyword gaps.
    declared_text = {f["text"].lower() for f in facts if f.get("declared")}
    wanted: list[tuple[str, list[str], str]] = []
    for m in base.get("missing_must", [])[:4]:
        sk = [pretty(x) for x in sorted(find_skills(m))][:3] or [m[:90]]
        wanted.append((f"Cover required skill: {m[:70]}", sk, f"The job requires \"{m}\" and nothing in your verified facts shows it."))
    for k in [k for k in keywords if k.get("state") == "gap"][:4]:
        wanted.append((f"Add keyword: {k['word']}", [k["word"]], f"The job asks for {k['word']}, which no verified fact supports."))
    for title, skills, why in wanted:
        skills = [x for x in skills if x.lower() not in declared_text and x.lower() not in used_skills]
        if not skills:
            continue
        sim = facts + [_sim_declared(facts, i, x) for i, x in enumerate(skills)]
        d = _sim_total(analysis, sim, resume, projects, profile, years, matches, only_unmet=True) - cur
        if d > 0:
            used_skills.update(x.lower() for x in skills)
            acts.append({"impact": d, "prio": 0, "title": title, "action_type": "declare_skill", "skills": skills, "verified": False, "project": "Skills",
                         "detail": why + " Accepting declares it as a self-declared skill: it counts at half weight and is labelled as unproven. Add a project or source that shows it to earn full credit.",
                         "suggested_bullet": "Declare: " + ", ".join(skills)})

    # 2. Verify an unconfirmed claim (the matcher only counts verified facts)
    pending = [f for f in facts if f.get("status") == "pending" and not f.get("declared")]
    seen_proj: set[str] = set()
    for f in pending:
        proj = f.get("project") or "Career Experience"
        if proj in seen_proj or len(seen_proj) >= 4:
            continue
        seen_proj.add(proj)
        sim = [dict(x, status="verified") if x["id"] == f["id"] else x for x in facts]
        d = _sim_total(analysis, sim, resume, projects, profile, years) - cur
        if d > 0:
            acts.append({"impact": d, "prio": 1, "title": f"Verify unconfirmed claim from {proj}", "action_type": "verify_fact", "fact_id": f["id"], "verified": False,
                         "project": proj, "suggested_bullet": f.get("text", ""),
                         "detail": f"You cataloged: \"{f.get('text', '')[:110]}\". Once you confirm it, it counts as evidence for the job's requirements."})

    # 3. Grounded keyword rewrite (a verified fact already supports it): adds that bullet to the resume
    for k in [k for k in keywords if k.get("state") == "suggested"][:3]:
        fact_obj = by_id.get(k.get("fact"))
        if not fact_obj:
            continue
        text = k.get("rewrite") or fact_obj.get("text") or ""
        ok = verify_bullet(text, [fact_obj["id"]], by_id)["ok"]
        sim_resume = {**resume, "bullets": resume.get("bullets", []) + [{"id": "SIMK", "project": fact_obj.get("project", ""), "kind": "project", "text": text,
                                                                         "facts": [fact_obj["id"]], "verified": ok, "user": False}]}
        d = _sim_total(analysis, facts, sim_resume, projects, profile, years) - cur
        if d > 0:
            acts.append({"impact": d, "prio": 2, "title": f"Add '{k['word']}' to {fact_obj.get('project', 'your resume')}", "action_type": "keyword_rewrite", "keyword_id": k.get("id"),
                         "verified": True, "project": fact_obj.get("project", ""), "suggested_bullet": text,
                         "detail": f"Proven by your verified experience: \"{text[:110]}\". Adding it puts {k['word']} on the resume with proof."})

    acts.sort(key=lambda r: (-r["impact"], r["prio"]))
    advice: list[dict] = []
    # 4. Advice only (no automatic change: these need your real information, so they are not offered as one-click adds)
    advice.append({"impact": 0, "title": "Quantify your bullets with real numbers", "action_type": "advice", "verified": False, "project": "",
                   "detail": "Bullets with a real number (users, % faster, time saved) score higher on Evidence quality. Edit a bullet and add a figure you can prove.", "suggested_bullet": ""})
    e = next((c for c in base.get("components", []) if c.get("key") == NAMES.get("E")), None)
    if e and not e.get("scored") and years is None:
        advice.append({"impact": 0, "title": "Add your years of experience", "action_type": "advice", "verified": False, "project": "",
                       "detail": "Add it in Add Sources > Your details so Experience can be scored. If it is below what the job asks, the score can go down: it is an honest measure, not a bonus.",
                       "suggested_bullet": ""})

    out = []
    for i, r in enumerate((acts + advice)[:5]):
        out.append({"n": i + 1, "title": r["title"], "impact": f"+{r['impact']} pts" if r["impact"] > 0 else "Advice", "delta": r["impact"], "detail": r["detail"],
                    "verified": bool(r.get("verified", False)), "suggested_bullet": r.get("suggested_bullet", ""), "project": r.get("project", ""),
                    "keyword_id": r.get("keyword_id"), "action_type": r["action_type"], "fact_id": r.get("fact_id"), "skills": r.get("skills", [])})
    if len(_REC_CACHE) > 64:
        _REC_CACHE.clear()
    _REC_CACHE[key] = out
    return out
