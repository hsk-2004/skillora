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


def _user(uid: int) -> dict:
    return _state.setdefault(uid, {"running": {}, "recent": deque(maxlen=40)})


@contextmanager
def step(uid: int | None, agent: str, tech: str, note: str = ""):
    """Mark an agent as working for the duration of the block. Yields a dict the caller may fill (note, mode)."""
    info = {"note": note, "mode": ""}
    if uid is None:
        yield info
        return
    sid, start = next(_ids), time.time()
    with _lock:
        _user(uid)["running"][sid] = {"id": sid, "agent": agent, "tech": tech, "start": start, "note": note}
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
            u["recent"].append({"id": sid, "agent": agent, "tech": tech, "ms": ms, "state": state, "note": info.get("note", ""), "mode": info.get("mode", ""), "at": time.time()})
        _audit("agent", agent, tech, info.get("note", ""), state, ms, uid)


def _audit(kind, agent, tech, note, state, ms, uid):
    from .core import audit

    audit.record(uid, kind, agent, f"{tech} - {note}" if note else tech, "error" if state == "error" else "ok", ms)


def event(uid: int | None, agent: str, tech: str, note: str = "", mode: str = "") -> None:
    """An instant step (cache hit, a callback that ran inside another call)."""
    _audit("callback", agent, tech, note, "done", 0, uid)
    if uid is None:
        return
    with _lock:
        _user(uid)["recent"].append({"id": next(_ids), "agent": agent, "tech": tech, "ms": 0, "state": "done", "note": note, "mode": mode, "at": time.time()})


def snapshot(uid: int) -> dict:
    now = time.time()
    with _lock:
        u = _user(uid)
        running = [{**r, "elapsed_ms": int((now - r["start"]) * 1000)} for r in u["running"].values()]
        recent = list(u["recent"])[-14:][::-1]
    return {"running": running, "recent": recent, "now": now}
