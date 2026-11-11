"""Live agent activity feed (per user, in memory).

Every agent / tool step wraps its work in `step(uid, agent, tech)`. The frontend polls /api/activity and shows
which agent is working right now, on which technology, and how long recent steps took. It reports what really ran:
nothing here is simulated.
"""
import itertools
import threading
import time
from collections import deque
from contextlib import contextmanager

_lock = threading.Lock()
_ids = itertools.count(1)
_state: dict[int, dict] = {}


def meta(agent: str, tech: str) -> tuple[str, str]:
    """(external API, model) behind a step, derived from its technology label."""
    from .config import GEMINI_MODELS

    t = tech.lower()
    if "cache" in t:
        return "Database cache (no API call)", ""
    if "a2a" in t:  # the planner (CrewAI) and the remote writer (ADK) both call Gemini behind the A2A message
        return "A2A protocol (HTTP, JSON-RPC) → Google Gemini API", (GEMINI_MODELS[0] if GEMINI_MODELS else "gemini")
    if "mcp" in t:
        return "MCP tool server (local)", ""
    if "exact" in t and "adjudication" not in t:  # Matcher tiers are local string / similarity maths
        return "None (plain Python)", ""
    if "rules" in t or t.startswith("python") or "callback" in t or "unavailable" in t:
        return "None (plain Python)", ""
    model = GEMINI_MODELS[0] if GEMINI_MODELS else "gemini"
    if "adk" in t:
        return "Google Gemini API via google-genai", model
    if "crewai" in t or "gemini" in t:
        return "Google Gemini API via LiteLLM", model
    return "None (plain Python)", ""


def _actual_model(default: str) -> str:
    try:
        from .llm import _used

        return getattr(_used, "model", "") or default
    except Exception:  # noqa: BLE001
        return default


def _user(uid: int) -> dict:
    return _state.setdefault(uid, {"running": {}, "recent": deque(maxlen=40)})


@contextmanager
def step(uid: int | None, agent: str, tech: str, note: str = ""):
    """Mark an agent as working for the duration of the block. Yields a dict the caller may fill (note, mode)."""
    info = {"note": note, "mode": ""}
    api, model = meta(agent, tech)
    try:
        from .llm import _used

        _used.model = ""
    except Exception:  # noqa: BLE001
        pass
    if uid is None:
        yield info
        return
    sid, start = next(_ids), time.time()
    with _lock:
        _user(uid)["running"][sid] = {"id": sid, "agent": agent, "tech": tech, "start": start, "note": note, "api": api, "model": model}
    state = "done"
    try:
        yield info
    except Exception:
        state = "error"
        raise
    finally:
        ms = int((time.time() - start) * 1000)
        with _lock:
            u = _user(uid)
            u["running"].pop(sid, None)
            done_model = _actual_model(model) if model else ""
            u["recent"].append({"id": sid, "agent": agent, "tech": tech, "ms": ms, "state": state, "note": info.get("note", ""), "mode": info.get("mode", ""), "at": time.time(), "api": api, "model": done_model})
        _audit("agent", agent, tech, info.get("note", ""), state, ms, uid, api, done_model)


def _audit(kind, agent, tech, note, state, ms, uid, api="", model=""):
    from .core import audit

    audit.record(uid, kind, agent, f"{tech} - {note}" if note else tech, "error" if state == "error" else "ok", ms, api=api, model=model)


def event(uid: int | None, agent: str, tech: str, note: str = "", mode: str = "") -> None:
    """An instant step (cache hit, a callback that ran inside another call)."""
    api, model = meta(agent, tech)
    _audit("callback", agent, tech, note, "done", 0, uid, api, model)
    if uid is None:
        return
    with _lock:
        _user(uid)["recent"].append({"id": next(_ids), "agent": agent, "tech": tech, "ms": 0, "state": "done", "note": note, "mode": mode, "at": time.time(), "api": api, "model": ""})


def snapshot(uid: int) -> dict:
    now = time.time()
    with _lock:
        u = _user(uid)
        running = [{**r, "elapsed_ms": int((now - r["start"]) * 1000)} for r in u["running"].values()]
        recent = list(u["recent"])[-14:][::-1]
    return {"running": running, "recent": recent, "now": now}
