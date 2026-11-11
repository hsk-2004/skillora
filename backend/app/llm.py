"""Small helpers shared by the CrewAI and ADK sides: JSON recovery + Gemini model fallback chain."""
import json
import re
import threading
import time
from typing import Callable, TypeVar

from .config import GEMINI_API_KEY, GEMINI_MODELS, LLM_TIMEOUT, USE_LLM

T = TypeVar("T")
_used = threading.local()  # model that handled the current thread's last LLM call (read by activity.py)


def parse_json(text: str):
    """Recover JSON from an LLM reply (code fences, preamble, trailing prose)."""
    if not text:
        return None
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.I)
    try:
        return json.loads(t)
    except Exception:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        i, j = t.find(opener), t.rfind(closer)
        if i != -1 and j > i:
            try:
                return json.loads(t[i : j + 1])
            except Exception:
                continue
    return None


def crew_llm(model: str):
    from crewai import LLM

    return LLM(model=f"gemini/{model}", api_key=GEMINI_API_KEY, temperature=0.1, timeout=LLM_TIMEOUT, max_retries=1)


def with_models(fn: Callable[[str], T]) -> T:
    """Try each configured Gemini model in turn (free-tier models return 503 when busy)."""
    if not USE_LLM:
        raise RuntimeError("LLM disabled")
    last: Exception | None = None
    for attempt in range(2):  # free-tier models often return 503 "high demand": second pass after a short wait
        for m in GEMINI_MODELS:
            try:
                _used.model = m
                return fn(m)
            except Exception as e:  # noqa: BLE001 - any provider/framework error -> next model
                last = e
        if attempt == 0:
            time.sleep(4)
    raise RuntimeError(f"all Gemini models failed: {last}")
