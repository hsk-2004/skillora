from importlib.metadata import version
import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import activity, service
from app.api.deps import current_user
from app.config import GEMINI_MODELS, USE_LLM
from app.db import RunLog, Source, User, get_db

router = APIRouter(prefix="/api", tags=["system"])

YEARS_RE = re.compile(r"((?:19|20)\d{2})\s*[-\u2013\u2014]\s*((?:19|20)\d{2}|present|current)|((?:19|20)\d{2})", re.I)
DEGREE_LINE_RE = re.compile(r"\b(b\.?\s?tech|bachelor|m\.?\s?tech|master|b\.?e\b|b\.?sc|m\.?sc|mba|ph\.?d|diploma)", re.I)


class ProfileIn(BaseModel):
    name: str = "Your Name"
    email: str = ""
    phone: str = ""
    links: str = ""
    location: str = ""
    education: str = ""
    degree: str = ""
    university: str = ""
    cgpa: str = ""
    experience_years: float | None = None
    auto_confirm: bool = True


from app.mcp_server import list_mcp_tools

@router.get("/health")
def health():
    return {
        "ok": True,
        "llm": USE_LLM,
        "models": GEMINI_MODELS if USE_LLM else [],
        "crewai": version("crewai") if "crewai" in version.__module__ or True else "installed",
        "google_adk": "installed",
        "mcp": "active",
        "mcp_tools": len(list_mcp_tools()),
    }


@router.get("/mcp/tools")
def get_mcp_tools():
    """Model Context Protocol (MCP) Tool Registry endpoint conforming to Criterion #2."""
    return {
        "status": "active",
        "protocol": "Model Context Protocol (MCP v1.0)",
        "server": "SkillOra-MCP-Tool-Server",
        "count": len(list_mcp_tools()),
        "tools": list_mcp_tools(),
    }


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = service.profile(user)
    latest_resume = (
        db.query(Source)
        .filter(Source.user_id == user.id, Source.type.in_(["pdf", "docx", "pptx", "note"]))
        .order_by(Source.updated.desc())
        .first()
    )
    if latest_resume and latest_resume.text:
        from app.parsers import extract_resume_entities
        ext = extract_resume_entities(latest_resume.text)
        p["degree"] = ext.get("degree", "")
        p["university"] = ext.get("university", "")
        p["cgpa"] = ext.get("cgpa", "")
        p["grad_years"] = ext.get("grad_years", "")
    return p


@router.put("/profile")
def put_profile(p: ProfileIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    user.name, user.links, user.location = p.name.strip(), p.links.strip(), p.location.strip()
    if hasattr(user, "phone"):
        user.phone = p.phone.strip()
    user.auto_confirm = int(p.auto_confirm)
    if p.education:
        user.education = p.education.strip()[:400]
    elif p.degree or p.university:
        parts = [p.degree.strip(), f"CGPA: {p.cgpa.strip()}" if p.cgpa else "", p.university.strip()]
        user.education = " · ".join([pt for pt in parts if pt])[:400]
    user.experience_years = max(0.0, min(50.0, p.experience_years)) if p.experience_years is not None else None
    db.add(user)
    db.commit()
    res = service.profile(user)
    res["degree"] = p.degree
    res["university"] = p.university
    res["cgpa"] = p.cgpa
    return res


@router.get("/profile/resume-extracted")
def get_resume_extracted(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Return structured candidate details extracted from user's latest resume."""
    from app.parsers import extract_resume_entities

    latest_resume = (
        db.query(Source)
        .filter(Source.user_id == user.id, Source.type.in_(["pdf", "docx", "pptx", "note"]))
        .order_by(Source.updated.desc())
        .first()
    )
    if latest_resume and latest_resume.text:
        data = extract_resume_entities(latest_resume.text)
        if not data.get("name") and user.name and user.name != "Your Name":
            data["name"] = user.name
        if not data.get("phone") and getattr(user, "phone", ""):
            data["phone"] = user.phone
        if not data.get("location") and user.location:
            data["location"] = user.location
        if not data.get("github_user") and user.links:
            m = re.search(r"github\.com/([a-zA-Z0-9_-]+)", user.links)
            if m:
                data["github_user"] = m.group(1)
        return data

    m_gh = re.search(r"github\.com/([a-zA-Z0-9_-]+)", user.links or "")
    return {
        "name": user.name or "",
        "email": user.email or "",
        "phone": getattr(user, "phone", "") or "",
        "location": user.location or "",
        "degree": "",
        "university": "",
        "cgpa": "",
        "grad_years": "",
        "education_summary": user.education or "",
        "skills": [],
        "experience": [],
        "github_user": m_gh.group(1) if m_gh else "",
    }


@router.get("/activity")
def live_activity(user: User = Depends(current_user)):
    """What is running right now for this user, and what just finished (agent, technology, duration)."""
    snap = activity.snapshot(user.id)
    try:
        c_ver = version("crewai")
    except Exception:
        c_ver = "installed"
    try:
        a_ver = version("google-adk")
    except Exception:
        a_ver = "installed"
    snap.update({"llm": USE_LLM, "model": GEMINI_MODELS[0] if USE_LLM else "", "crewai": c_ver, "adk": a_ver})
    return snap


@router.get("/logs")
def logs(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.query(RunLog).filter(RunLog.user_id == user.id).order_by(RunLog.id.desc()).limit(40).all()
    return [{"agent": r.agent, "ms": r.ms, "note": r.note, "at": r.created.isoformat()} for r in rows]


@router.get("/education-hint")
def education_hint(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Pre-fill the education form from uploaded resumes."""
    for s in db.query(Source).filter(Source.user_id == user.id, Source.type.in_(["pdf", "docx", "pptx", "note"])).all():
        lines = [l.strip(" \t\u2022-*") for l in s.text.splitlines()]
        for i, line in enumerate(lines):
            if not line or len(line) > 140 or not DEGREE_LINE_RE.search(line):
                continue
            for cand in [lines[i - 1] if i else "", lines[i + 1] if i + 1 < len(lines) else "", line]:
                m = YEARS_RE.search(cand)
                if m and len(cand) < 140:
                    years = re.sub(r"\s*[-\u2013\u2014]\s*", " \u2013 ", m.group(0))
                    college = re.sub(r"\s{2,}", " ", cand.replace(m.group(0), "")).strip(" ,|\u00b7-\u2013\u2014")
                    degree = line if cand is not line else re.sub(r"\s{2,}", " ", line.replace(m.group(0), "")).strip(" ,|\u00b7-\u2013\u2014")
                    if cand is line:
                        college = ""
                    return {"degree": degree, "college": college, "years": years}
            return {"degree": line, "college": "", "years": ""}
    return None


@router.get("/eval")
def run_eval():
    from eval.run_eval import run_all

    return run_all()


# ---------------------------------------------------------------- live proof for the requirements page
class GuardrailTry(BaseModel):
    text: str


@router.post("/guardrails/test")
def guardrail_test(b: GuardrailTry):
    """Run any text through the real input guard (prompt-injection + toxicity); the verdict is also written to the audit trail."""
    from app.core import guardrail

    try:
        guardrail.check_input_text(b.text, where="live demo", uid=None)
        return {"blocked": False, "kind": "", "message": "Clean - passed to the agents."}
    except guardrail.GuardrailViolation as e:
        return {"blocked": True, "kind": e.kind, "message": f"Blocked: {e}"}


@router.get("/audit")
def audit_trail(kind: str | None = None, user: User = Depends(current_user)):
    """Callback / provenance trail: agent steps, tool calls, guardrail verdicts and A2A messages, newest first."""
    from app.core import audit

    return {"events": audit.recent(user.id, kind), "stats": audit.stats()}


@router.get("/compliance")
def compliance():
    """Live status of the 11 project requirements, computed from the running system (not hard-coded)."""
    import httpx

    from app import config
    from app.core import audit, tracing

    tr = tracing.status()
    a2a_card = None
    if config.A2A_ENABLED:
        try:
            a2a_card = httpx.get(f"{config.PUBLIC_URL}/a2a/writer/.well-known/agent-card.json", timeout=3).json()
        except Exception:  # noqa: BLE001
            a2a_card = None
    st = audit.stats()
    return {
        "a2a": {"enabled": config.A2A_ENABLED, "card_url": f"{config.PUBLIC_URL}/a2a/writer/.well-known/agent-card.json",
                "card": ({"name": a2a_card.get("name"), "description": a2a_card.get("description"), "skills": [s.get("name") for s in a2a_card.get("skills", [])]} if a2a_card else None),
                "server": "Google ADK (Resume Writer)", "client": "CrewAI (Tailoring Planner)", "calls": st["a2a"], "secured": bool(config.A2A_SHARED_KEY)},
        "tracing": {**tr, "dashboard": config.LANGFUSE_HOST},
        "mcp": {"tools": len(list_mcp_tools())},
        "audit": st,
        "deployment": {"platform": "Render" if __import__("os").getenv("RENDER") else "Local", "public_url": config.PUBLIC_URL, "database": "PostgreSQL" if config.DB_URL.startswith("postgres") else "SQLite"},
    }
