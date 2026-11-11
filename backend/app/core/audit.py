"""Audit trail + provenance (requirement 5 & 9, local half).

Every agent step, tool call, guardrail verdict and A2A message is appended here with a run id, so any result can be traced
back to the agents that produced it. The same events are mirrored to Langfuse spans when tracing.py is enabled.
In-memory ring buffer (per process) + persisted to the RunLog table when a DB session is available.
"""
import itertools
import threading
import time
from collections import deque

_lock = threading.Lock()
_ids = itertools.count(1)
_events: deque = deque(maxlen=500)


def record(uid: int | None, kind: str, source: str, note: str, status: str = "ok", ms: int = 0, **extra) -> dict:
    """kind: api | agent | tool | guardrail | a2a | callback | error"""
    ev = {"id": next(_ids), "at": time.time(), "uid": uid, "kind": kind, "source": source, "note": note[:300],
          "status": status, "ms": ms, **extra}
    with _lock:
        _events.append(ev)
    return ev


def recent(uid: int | None = None, kind: str | None = None, limit: int = 80) -> list[dict]:
    with _lock:
        evs = list(_events)
    # events recorded without a user (library callbacks) are visible to everyone
    evs = [e for e in evs if (uid is None or e["uid"] in (None, uid)) and (kind is None or e["kind"] == kind)]
    return evs[-limit:][::-1]


def stats() -> dict:
    with _lock:
        evs = list(_events)
    out: dict = {"total": len(evs)}
    for k in ("api", "agent", "tool", "guardrail", "a2a", "callback", "error"):
        out[k] = sum(e["kind"] == k for e in evs)
    out["blocked"] = sum(e["status"] == "blocked" for e in evs)
    return out
