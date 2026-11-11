"""Observability (requirement 9): Langfuse Cloud tracing for CrewAI + Google ADK via OpenTelemetry / OpenInference.

Every LLM call, agent step and tool call of both frameworks becomes a span in ONE trace, including the A2A hop, so any
resume bullet can be traced back through planner -> A2A -> writer -> verifier (auditability + provenance).
Off (no-op) unless LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set.
"""
import logging
import os

from .. import config

log = logging.getLogger("skillora.tracing")
_state = {"enabled": False, "error": "", "client": None}


def init() -> dict:
    if _state["enabled"] or not config.TRACING_ENABLED:
        return status()
    try:
        os.environ["LANGFUSE_PUBLIC_KEY"] = config.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_SECRET_KEY"] = config.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_HOST"] = config.LANGFUSE_HOST
        os.environ["LANGFUSE_BASE_URL"] = config.LANGFUSE_HOST
        os.environ.pop("OTEL_SDK_DISABLED", None)
        from langfuse import get_client

        client = get_client()  # registers the OTel tracer provider that exports to Langfuse
        from openinference.instrumentation.crewai import CrewAIInstrumentor
        from openinference.instrumentation.google_adk import GoogleADKInstrumentor

        CrewAIInstrumentor().instrument()
        GoogleADKInstrumentor().instrument()
        _state.update(enabled=True, client=client, error="")
        log.info("Langfuse tracing enabled -> %s", config.LANGFUSE_HOST)
    except Exception as e:  # noqa: BLE001 - tracing must never break the app
        _state.update(enabled=False, error=str(e)[:200])
        log.warning("Langfuse tracing disabled: %s", e)
    return status()


def status() -> dict:
    return {"enabled": _state["enabled"], "host": config.LANGFUSE_HOST, "configured": config.TRACING_ENABLED,
            "error": _state["error"], "frameworks": ["CrewAI", "Google ADK"] if _state["enabled"] else []}


def flush() -> None:
    c = _state.get("client")
    if c:
        try:
            c.flush()
        except Exception:  # noqa: BLE001
            pass


def trace_url() -> str:
    return config.LANGFUSE_HOST if _state["enabled"] else ""
