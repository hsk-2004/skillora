"""A2A SERVER side (requirement 6): the Google ADK Resume Writer, exposed over the Agent2Agent protocol.

Mounted into the FastAPI app at /a2a/writer. Its public Agent Card is at /a2a/writer/.well-known/agent-card.json.
Any A2A client (here: the CrewAI Tailoring Planner) can discover and call it - it does not need to be ADK or Python.
"""
import json

from google.adk.a2a.utils.agent_to_a2a import to_a2a
from google.adk.agents import LlmAgent
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from starlette.responses import JSONResponse

from .. import config
from ..agents import adk_agents
from ..core import audit, guardrail

MOUNT = "/a2a/writer"


def _before_model(callback_context, llm_request):
    """Pull the shared context (facts, bundles, uid) out of the A2A message into ADK session state, then run the input guard.
    State cannot travel over A2A by itself, so the client sends it in a `_ctx` field of the JSON message."""
    for content in llm_request.contents or []:
        for part in content.parts or []:
            txt = (part.text or "").strip()
            if txt.startswith("{") and '"_ctx"' in txt:
                try:
                    data = json.loads(txt)
                except ValueError:
                    continue
                ctx = data.pop("_ctx", None) or {}
                for k, v in ctx.items():
                    callback_context.state[k] = v
                part.text = json.dumps(data)
    return guardrail.adk_input_guard(callback_context, llm_request)


def _after_model(callback_context, llm_response):
    """Run the Verifier, then ship its report back to the A2A client inside the reply (the client has no access to our state)."""
    adk_agents.verifier_callback(callback_context, llm_response)
    draft = callback_context.state.get("last_draft")
    if not draft:
        return None
    audit.record(callback_context.state.get("uid"), "a2a", "ADK Writer (A2A server)", "draft + verifier report returned to caller")
    out = {**draft, "verifier_report": callback_context.state.get("verifier_report")}
    return LlmResponse(content=types.Content(role="model", parts=[types.Part(text=json.dumps(out))]))


def make_remote_writer(model: str) -> LlmAgent:
    return LlmAgent(
        name="resume_writer",
        model=model,
        description="Writes resume bullets from verified fact IDs only and self-verifies every claim (Google ADK).",
        instruction=adk_agents.WRITER_INSTRUCTION,
        before_model_callback=_before_model,
        after_model_callback=_after_model,
        generate_content_config=adk_agents.FAST,
    )


class _KeyGate:
    """Tiny ASGI guard: the agent card stays public (discovery), every other A2A call needs X-A2A-Key when A2A_SHARED_KEY is set."""

    def __init__(self, app):
        self.app = app
        self.inner = app  # the Starlette app whose lifespan builds the A2A routes

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and config.A2A_SHARED_KEY and scope["path"].startswith(MOUNT) and "/.well-known/" not in scope["path"]:
            hdrs = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
            if hdrs.get("x-a2a-key") != config.A2A_SHARED_KEY:
                audit.record(None, "guardrail", "A2A gate", "BLOCKED A2A call without a valid X-A2A-Key", status="blocked")
                await JSONResponse({"error": "unauthorized"}, status_code=401)(scope, receive, send)
                return
        await self.app(scope, receive, send)


def build_app(agent=None):
    from urllib.parse import urlparse

    u = urlparse(config.PUBLIC_URL)
    port = u.port or (443 if u.scheme == "https" else 80)
    agent = agent or make_remote_writer(config.GEMINI_MODELS[0])
    app = to_a2a(agent, host=u.hostname or "localhost", port=port, protocol=u.scheme or "http", rpc_path=MOUNT.strip("/"))
    return _KeyGate(app)
