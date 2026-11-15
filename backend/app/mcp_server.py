"""Model Context Protocol (MCP) tool server for SkillOra (requirement 2).

Four tools that run the project's REAL code, served over MCP "streamable HTTP" and mounted in the FastAPI app at /mcp/.
Agents and the ingestion flow call them through the MCP protocol (see app/mcp_client.py) instead of importing the code directly:

  file_parser_mcp      reads a resume / slide / note file into text       (used by the resume-upload step)
  github_crawler_mcp   reads a GitHub repo: README, languages, manifests  (used by the GitHub-source step)
  ledger_db_lookup_mcp looks up the user's facts in the fact ledger       (used by the ADK Coordinator)
  ats_calculator_mcp   what-if job-fit score from the five parts          (used by the ADK Coordinator)

Security: every call must carry X-MCP-Key (when MCP_SHARED_KEY is set) or come from this machine (loopback). The user the call
is for comes from the X-User-Id header set by our own client code, never from a model-written argument, so a prompt-injected
agent cannot read another user's facts.
"""
import base64
import time
from typing import Any

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .core import audit

# stateless + JSON responses: each call is independent, which also works behind a load balancer.
mcp = FastMCP(
    "SkillOra-MCP-Tool-Server",
    streamable_http_path="/",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def _uid(ctx: Context | None) -> int | None:
    """The user this call is for, taken from the trusted header set by our own client."""
    try:
        v = ctx.request_context.request.headers.get("x-user-id")  # type: ignore[union-attr]
        return int(v) if v else None
    except Exception:  # noqa: BLE001
        return None


def _log(ctx: Context | None, tool: str, note: str, t0: float, status: str = "ok") -> None:
    audit.record(_uid(ctx), "mcp", f"MCP server · {tool}", note, status=status, ms=int((time.time() - t0) * 1000))


# ------------------------------------------------------------------ 1. file parser
@mcp.tool()
def file_parser_mcp(file_name: str, content_base64: str, ctx: Context) -> dict[str, Any]:
    """Parse a resume, slide deck, note or zip into plain text. content_base64 is the file's bytes, base64-encoded.
    Returns the source type, the extracted text and any hyperlink URLs found."""
    from .parsers import parse_bytes

    t0 = time.time()
    try:
        data = base64.b64decode(content_base64)
        stype, text, urls = parse_bytes(file_name, data)
    except Exception as e:  # noqa: BLE001 - report to the caller, never crash the server
        _log(ctx, "file_parser_mcp", f"{file_name}: {e}"[:200], t0, "error")
        return {"status": "error", "message": str(e)}
    _log(ctx, "file_parser_mcp", f"{file_name} -> {stype}, {len(text):,} characters", t0)
    return {"status": "success", "source_type": stype, "characters": len(text), "text": text, "urls": urls}


# ------------------------------------------------------------------ 2. GitHub crawler
@mcp.tool()
def github_crawler_mcp(repo: str, ctx: Context) -> dict[str, Any]:
    """Read a public GitHub repo (owner/repo or URL): description, languages, README and dependency manifests, as text."""
    from .parsers import fetch_github

    t0 = time.time()
    try:
        name, text, detail = fetch_github(repo)
    except Exception as e:  # noqa: BLE001
        _log(ctx, "github_crawler_mcp", f"{repo}: {e}"[:200], t0, "error")
        return {"status": "error", "message": str(e)}
    _log(ctx, "github_crawler_mcp", f"{name} · {len(text):,} characters", t0)
    return {"status": "success", "name": name, "detail": detail, "characters": len(text), "text": text}


# ------------------------------------------------------------------ 3. ledger lookup
@mcp.tool()
def ledger_db_lookup_mcp(ctx: Context, project: str | None = None, status: str = "verified", limit: int = 20) -> dict[str, Any]:
    """Look up the signed-in user's facts in the fact ledger. Optional filters: project name and status (verified, pending, rejected).
    Each fact has its id, text, project, category, status and the exact source quote."""
    from .db import SessionLocal
    from .engine.matching import fact_view
    from .service import all_facts

    t0 = time.time()
    uid = _uid(ctx)
    if uid is None:
        _log(ctx, "ledger_db_lookup_mcp", "no user on the call", t0, "blocked")
        return {"status": "error", "message": "No user for this call."}
    db = SessionLocal()
    try:
        facts = [fact_view(f) for f in all_facts(db, uid, include_rejected=True)]
    finally:
        db.close()
    rows = [f for f in facts if (status == "all" or f["status"] == status) and (not project or f["project"].lower() == project.lower())]
    out = [{"id": f["id"], "text": f["text"], "project": f["project"], "category": f["category"], "status": f["status"], "quote": f["span"]} for f in rows[: max(1, min(limit, 50))]]
    _log(ctx, "ledger_db_lookup_mcp", f"{len(out)} of {len(rows)} facts (status={status}{', project=' + project if project else ''})", t0)
    return {"status": "success", "count": len(out), "total_matching": len(rows), "facts": out}


# ------------------------------------------------------------------ 4. score calculator
@mcp.tool()
def ats_calculator_mcp(
    ctx: Context,
    skills_match: float,
    responsibility: float,
    evidence: float,
    education: float,
    experience: float | None = None,
    profile: str = "standard",
) -> dict[str, Any]:
    """What-if job-fit score. Give each part as 0-100: skills_match, responsibility, evidence, education, and experience (leave it out if
    unknown). profile is standard, skills_first, credentials_first or graduate. Uses the same weights and rules as the scoring engine:
    a part that cannot be scored is left out and its weight is shared by the others."""
    from .engine.scoring import NAMES, profile_info

    t0 = time.time()
    prof = profile_info(profile)
    vals = {"K": skills_match, "J": responsibility, "E": experience, "Q": evidence, "A": education}
    active = {k: prof["weights"][k] for k, v in vals.items() if v is not None and prof["weights"].get(k, 0) > 0}
    wsum = sum(active.values()) or 1
    parts = [{"part": NAMES[k], "value": vals[k], "weight_percent": round(100 * w / wsum, 1), "points": round(vals[k] * w / wsum, 1)} for k, w in active.items()]
    total = round(sum(vals[k] * w for k, w in active.items()) / wsum)
    _log(ctx, "ats_calculator_mcp", f"{prof['label']}: score {total}", t0)
    return {"status": "success", "score": total, "profile": prof["id"], "parts": parts, "note": "A part that is not scored has its weight shared by the others."}


class McpGate:
    """ASGI guard in front of the MCP app: needs X-MCP-Key when MCP_SHARED_KEY is set, otherwise only loopback callers are accepted."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            from starlette.responses import JSONResponse

            from . import config

            hdrs = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
            host = (scope.get("client") or ("", 0))[0]
            ok = hdrs.get("x-mcp-key") == config.MCP_SHARED_KEY if config.MCP_SHARED_KEY else host in ("127.0.0.1", "::1", "localhost")
            if not ok:
                audit.record(None, "guardrail", "MCP gate", "BLOCKED MCP call without a valid key", status="blocked")
                await JSONResponse({"error": "unauthorized"}, status_code=401)(scope, receive, send)
                return
        await self.app(scope, receive, send)


# ------------------------------------------------------------------ registry (for /api/mcp/tools and the MCP page)
TOOL_INFO = [
    {
        "name": "file_parser_mcp", "title": "Document parser",
        "does": "Turns an uploaded resume, slide deck, note or zip into plain text, and collects the links inside it.",
        "used_by": [{"agent": "Source Extractor flow (CrewAI)", "when": "when you upload a resume or file"}],
        "why": "Reading files is a separate, reusable job. Behind MCP, any agent can use the same parser, and every use is logged.",
        "inputs": ["file_name", "content_base64"],
    },
    {
        "name": "github_crawler_mcp", "title": "GitHub reader",
        "does": "Reads a public GitHub repo: description, languages, README and dependency files.",
        "used_by": [{"agent": "Source Extractor flow (CrewAI)", "when": "when you add a GitHub repo"}],
        "why": "The agent needs repo evidence but should not hold GitHub code or keys. The tool does the fetching and returns plain text.",
        "inputs": ["repo"],
    },
    {
        "name": "ledger_db_lookup_mcp", "title": "Fact ledger lookup",
        "does": "Looks up your facts (verified, pending or rejected) with their exact source quotes.",
        "used_by": [{"agent": "Coordinator (Google ADK)", "when": "when you ask the chat about your facts or evidence"}],
        "why": "The chat agent can check what is really in your ledger before answering, instead of guessing. It only sees your own facts.",
        "inputs": ["project", "status", "limit"],
    },
    {
        "name": "ats_calculator_mcp", "title": "Score calculator",
        "does": "Works out a what-if job-fit score from the five parts, with the real weights and profiles.",
        "used_by": [{"agent": "Coordinator (Google ADK)", "when": "when you ask the chat 'what if' questions about your score"}],
        "why": "Arithmetic belongs in code, not in a language model. The agent asks the tool, so the number is exact and explainable.",
        "inputs": ["skills_match", "responsibility", "evidence", "education", "experience", "profile"],
    },
]


def list_mcp_tools() -> list[dict[str, Any]]:
    """Registry used by /api/mcp/tools, /api/health and the MCP page."""
    return [dict(t, type="MCP tool") for t in TOOL_INFO]
