"""Google ADK agents - the interactive, stateful tailoring side.

  Resume Writer   LlmAgent  - drafts bullets + summary from fact IDs only
  Verifier        after_model_callback - checks every claim against its cited span (deterministic number/tech
                  checks) and writes a report into session state; unsupported claims are sent back to the Writer
  Coordinator     LlmAgent  - runs the chat session, delegates to Project Selector / Writer, uses tools
"""
import asyncio
import json
import uuid

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

FAST = types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level="minimal"))  # rewriting needs no deep reasoning

from .. import activity
from ..engine.verify import verify_bullet
from ..llm import parse_json, with_models
from ..vocab import find_skills
from ..core import guardrail

APP = "skillora"
USER = "candidate"
SESSIONS = InMemorySessionService()

WRITER_INSTRUCTION = """You are the Resume Writer for SkillOra.
You receive JSON with the target `job` and a list of `items`. Each item has an `id`, a `project`, `details` (one or more verified
facts about that project) and optionally `stack` (the technologies the project was built with).
Write ONE resume bullet per item and ONE professional summary.

BULLET STYLE: 28-40 words, one fuller sentence that elaborates and weaves ALL of the item's `details` together (not a list of fragments):
strong past-tense verb first, then what was built or done, how it works or who it serves, which technologies were used (from `stack`),
and the outcome only if a detail states it. Explain, do not just restate. Prefer the job's own wording when the details already say the same thing.

HARD RULES (a Verifier will reject violations):
- A bullet may use ONLY information in its own item (`details` and `stack`). Never add numbers, percentages, tools, technologies,
  users, results or outcomes that are not stated there. Keep every number exactly as written. Do not pad with generic filler.
- You may reorder words and use the job's wording ONLY when the fact already says it (synonyms are fine).
- Start each bullet with a strong past-tense verb, max 28 words, no first person.
- The summary: 1-2 sentences, may mention only skills that appear in the provided facts, no numbers unless in the facts, and NO seniority or
  quality claims (never write 'experienced', 'expert', 'proven', 'extensive', years of experience). Describe the candidate as early-career.
- If you are told which bullets the Verifier rejected, rewrite ONLY those and keep the others identical.

Return ONLY JSON: {"summary":"...","bullets":[{"fact":"<item id>","text":"..."}]}"""


def verifier_callback(callback_context: CallbackContext, llm_response: LlmResponse):
    """ADK after_model_callback = the Verifier. Writes `verifier_report` to session state."""
    try:
        text = "".join(p.text or "" for p in llm_response.content.parts) if llm_response.content else ""
    except Exception:  # noqa: BLE001
        return None
    data = parse_json(text)
    if not isinstance(data, dict):
        callback_context.state["verifier_report"] = {"parse_error": True}
        return None
    facts = callback_context.state.get("facts", {})
    pool_ids = callback_context.state.get("pool_ids", [])
    report = {"bullets": {}, "summary": None}
    for b in data.get("bullets", []):
        fid = b.get("fact")
        ids = callback_context.state.get("bundles", {}).get(fid) or [fid]  # a bullet may cite several facts (+ the project's tech stack)
        report["bullets"][fid] = verify_bullet(str(b.get("text", "")), ids, facts)
    if data.get("summary"):
        report["summary"] = verify_bullet(str(data["summary"]), pool_ids, facts)
    callback_context.state["verifier_report"] = report
    rejected = sum(1 for r in report["bullets"].values() if not r["ok"])
    activity.event(callback_context.state.get("uid"), "Verifier", "Google ADK callback · Python checks",
                   note=f"{len(report['bullets'])} bullets checked, {rejected} rejected" + (" - sent back to the Writer" if rejected else ""))
    callback_context.state["last_draft"] = data
    return None  # keep the draft; the revision loop decides what to do with failures


def make_writer(model: str) -> LlmAgent:
    return LlmAgent(
        name="resume_writer",
        model=model,
        description="Writes resume bullets and a summary using fact IDs only.",
        instruction=WRITER_INSTRUCTION,
        before_model_callback=guardrail.adk_input_guard,
        after_model_callback=verifier_callback,
        generate_content_config=FAST,
    )


async def _ask(agent: LlmAgent, session_id: str, message: str, state: dict | None = None) -> str:
    sess = await SESSIONS.get_session(app_name=APP, user_id=USER, session_id=session_id)
    if sess is None:
        await SESSIONS.create_session(app_name=APP, user_id=USER, session_id=session_id, state=state or {})
    runner = Runner(agent=agent, app_name=APP, session_service=SESSIONS)
    final = ""
    async for ev in runner.run_async(user_id=USER, session_id=session_id, new_message=types.Content(role="user", parts=[types.Part(text=message)])):
        if ev.is_final_response() and ev.content and ev.content.parts:
            final = "".join(p.text or "" for p in ev.content.parts)
    return final


async def _state(session_id: str) -> dict:
    s = await SESSIONS.get_session(app_name=APP, user_id=USER, session_id=session_id)
    return dict(s.state) if s else {}


async def _write_loop(model: str, analysis: dict, targets: list[dict], pool: list[dict], uid: int | None = None, max_rounds: int = 2):
    sid = "w-" + uuid.uuid4().hex[:8]
    facts_by_id = {f["id"]: f for f in pool}
    agent = make_writer(model)
    job = {"title": analysis["title"], "keywords": analysis["keywords"][:12], "must_haves": [r["text"] for r in analysis["requirements"] if r["level"] == "must"][:8]}
    msg = json.dumps({"job": job, "items": [{"id": f["id"], "project": f["project"], "details": f.get("details") or [f["text"]], "stack": f.get("stack", "")} for f in targets]})
    attempts = {f["id"]: 1 for f in targets}
    with activity.step(uid, "Resume Writer", f"Google ADK · {model}"):
        await _ask(agent, sid, msg, {"uid": uid, "facts": facts_by_id, "pool_ids": [f["id"] for f in pool], "bundles": {t["id"]: t.get("ids", [t["id"]]) for t in targets}})
    st = await _state(sid)
    draft = st.get("last_draft") or {}
    for _ in range(max_rounds - 1):
        rep = st.get("verifier_report") or {}
        bad = {fid: r["issues"] for fid, r in (rep.get("bullets") or {}).items() if not r["ok"]}
        sum_bad = rep.get("summary") and not rep["summary"]["ok"]
        if not bad and not sum_bad:
            break
        fb = {"verifier_rejected": [{"fact": fid, "issues": iss} for fid, iss in bad.items()]}
        if sum_bad:
            fb["summary_rejected"] = rep["summary"]["issues"]
        for fid in bad:
            attempts[fid] = attempts.get(fid, 1) + 1
        with activity.step(uid, "Resume Writer", f"Google ADK · {model} · revision"):
            await _ask(agent, sid, "The Verifier rejected these. Rewrite only them, strictly within each fact. " + json.dumps(fb))
        st = await _state(sid)
        new = st.get("last_draft") or {}
        merged = {b["fact"]: b for b in draft.get("bullets", [])}
        merged.update({b["fact"]: b for b in new.get("bullets", []) if b.get("fact") in bad})
        draft = {"summary": new.get("summary") or draft.get("summary"), "bullets": list(merged.values())}
    return draft, attempts


def write_with_verifier(analysis: dict, targets: list[dict], pool: list[dict], uid: int | None = None) -> tuple[dict, dict]:
    """Returns ({'summary':..,'bullets':[{fact,text}]}, attempts_by_fact). Raises if every model fails."""
    return with_models(lambda m: asyncio.run(_write_loop(m, analysis, targets, pool, uid)))


# ------------------------------------------------------------------ Coordinator (chat)
COORDINATOR_INSTRUCTION = """You are the SkillOra Coordinator. You help a job-seeker edit their tailored resume for one job.
The user is the author of their resume. When they ask for a change, MAKE IT with the tools, exactly as they ask,
even if it goes beyond the verified facts. Do not add claims they did not ask for.
- Call `get_resume` if needed to inspect bullets.
- Change summary: `set_summary`. Change a bullet: `set_bullet`. New bullet: `add_bullet`. Remove: `delete_bullet`.
  Skills list: `set_skills`. Undo or revert: `undo_last_edit` (call it once per step the user wants to go back).
- Include or exclude a project or job: `set_project_included`. Score questions: `explain_score`. Missing skills: `list_gaps`.
- CRITICAL: When the user asks to strengthen bullets, use XYZ metrics, highlight microservices, or tailor summary, DO NOT ASK FOR CLARIFICATION. CALL `add_bullet`, `set_bullet`, or `set_summary` IMMEDIATELY to commit the change to the resume.
- NEVER say you changed, reverted or restored something unless the tool call returned ok. If a tool returns an error, say so.
Reply in 1-2 short sentences that state exactly what changed."""


def make_coordinator(model: str, tools: list) -> LlmAgent:
    selector = LlmAgent(
        name="project_selector", model=model,
        description="Chooses which projects to feature based on task relevance to the job.",
        instruction="You explain in one sentence why a project is or is not relevant to the job, then use set_project_included if asked.",
        tools=[t for t in tools if t.__name__ == "set_project_included"],
    )
    return LlmAgent(
        name="coordinator", model=model, instruction=COORDINATOR_INSTRUCTION, tools=tools, sub_agents=[selector], generate_content_config=FAST,
        before_model_callback=guardrail.adk_input_guard, before_tool_callback=guardrail.adk_tool_guard, after_tool_callback=guardrail.adk_tool_result_guard,
        description="Runs the chat session and delegates to sub-agents.",
    )


def chat(session_key: str, message: str, tools: list, state: dict | None = None) -> str:
    def go(model: str) -> str:
        agent = make_coordinator(model, tools)
        return asyncio.run(_ask(agent, session_key, message, state))

    return with_models(go)
