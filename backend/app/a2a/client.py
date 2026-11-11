"""A2A CLIENT side (requirement 6): a CrewAI agent that delegates drafting to the remote ADK Resume Writer.

CrewAI "Tailoring Planner" owns a tool, `delegate_to_adk_writer`, which speaks A2A (agent-card discovery + message/send).
Result: CrewAI (planner) --A2A--> Google ADK (writer + verifier) - two different frameworks interoperating by protocol.
"""
import asyncio
import json
import uuid

import httpx

from .. import config
from ..core import audit


def _headers() -> dict:
    return {"X-A2A-Key": config.A2A_SHARED_KEY} if config.A2A_SHARED_KEY else {}


async def _call(base: str, payload: dict, context_id: str) -> dict:
    from a2a.client import ClientConfig, create_client
    from a2a.types import Message, Part, Role, SendMessageRequest

    async with httpx.AsyncClient(headers=_headers(), timeout=config.LLM_TIMEOUT * 3) as http:
        client = await create_client(base, client_config=ClientConfig(httpx_client=http, streaming=False))
        msg = Message(message_id=uuid.uuid4().hex, role=Role.ROLE_USER, context_id=context_id,
                      parts=[Part(text=json.dumps(payload))])
        text = ""
        async for ev in client.send_message(SendMessageRequest(message=msg)):
            text = _extract_text(ev) or text
        return {"text": text, "card": base}


def _extract_text(ev) -> str:
    """Agent text from an A2A StreamResponse (protobuf): task artifacts first, then a direct message, then the status message."""
    def parts_text(parts):
        return "".join(p.text for p in parts if getattr(p, "text", ""))

    for field in ("task", "artifact_update", "message", "status_update"):
        try:
            if not ev.HasField(field):
                continue
        except (ValueError, AttributeError):
            continue
        o = getattr(ev, field)
        if field == "task":
            t = "".join(parts_text(a.parts) for a in o.artifacts)
            if t:
                return t
            if o.status.HasField("message"):
                return parts_text(o.status.message.parts)
        elif field == "artifact_update":
            return parts_text(o.artifact.parts)
        elif field == "message":
            return parts_text(o.parts)
        elif field == "status_update" and o.status.HasField("message"):
            return parts_text(o.status.message.parts)
    return ""


def send_to_writer(payload: dict, context_id: str, uid: int | None = None) -> dict:
    """Blocking A2A call -> parsed JSON reply from the ADK writer ({'summary','bullets','verifier_report'})."""
    import time

    base = config.PUBLIC_URL + "/a2a/writer"
    t0 = time.time()
    try:
        res = asyncio.run(_call(base, payload, context_id))
    except Exception as e:  # noqa: BLE001
        audit.record(uid, "error", "A2A client (CrewAI)", f"A2A call failed: {e}"[:250], status="error")
        raise
    from ..llm import parse_json

    data = parse_json(res["text"])
    ms = int((time.time() - t0) * 1000)
    audit.record(uid, "a2a", "CrewAI → ADK Writer", f"A2A message/send to {base} answered in {ms} ms", ms=ms)
    if not isinstance(data, dict):
        raise ValueError("A2A writer returned no JSON")
    return data


def planner_delegate(payload: dict, context_id: str, uid: int | None = None) -> dict:
    """The CrewAI side. A CrewAI Agent (Tailoring Planner) is given the A2A call as a tool and instructed to delegate."""
    from crewai import Agent, Crew, Process, Task
    from crewai.tools import tool

    from ..llm import crew_llm, with_models

    box: dict = {}

    @tool("delegate_to_adk_writer")
    def delegate_to_adk_writer(note: str = "") -> str:
        """Send the prepared writing job to the remote Google ADK Resume Writer over the A2A protocol and return its reply."""
        box["reply"] = send_to_writer(payload, context_id, uid)
        return json.dumps({"bullets": len(box["reply"].get("bullets", []))})

    def go(model: str):
        agent = Agent(role="Tailoring Planner", goal="Delegate resume drafting to the specialist ADK Resume Writer agent via A2A",
                      backstory="You plan the job and hand writing to a remote specialist. You never write bullets yourself.",
                      llm=crew_llm(model), tools=[delegate_to_adk_writer], allow_delegation=False, verbose=False)
        task = Task(description="Call the delegate_to_adk_writer tool exactly once, then reply 'delegated'.", expected_output="delegated", agent=agent)
        Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False).kickoff()

    with_models(go)
    if "reply" not in box:  # the planner LLM skipped the tool: do the A2A call directly so the pipeline never stalls
        box["reply"] = send_to_writer(payload, context_id, uid)
    return box["reply"]
