from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.api.auth import router as auth_router
from app.api.facts import router as facts_router
from app.api.jobs import router as jobs_router
from app.api.sources import router as sources_router
from app.api.system import router as system_router
from app.config import CORS_ORIGINS
from app.db import init_db
from app.parsers import InputRejected
from app.core import tracing
from app.core.guardrail import GuardrailViolation

app = FastAPI(
    title="SkillOra API",
    version="1.0",
    description="SkillOra: AI-Powered Resume Intelligence & Job Readiness Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_QUIET = ("/api/audit", "/api/activity", "/api/health", "/api/compliance", "/docs", "/openapi.json")


@app.middleware("http")
async def _log_requests(request, call_next):
    """Audit trail: every API call (method, path, status, duration). Polling endpoints are skipped so the log stays readable."""
    import time as _t

    from app.core import audit

    path = request.url.path
    if request.method == "OPTIONS" or path == "/" or path.startswith(_QUIET):
        return await call_next(request)
    t0 = _t.time()
    try:
        resp = await call_next(request)
    except Exception as e:  # noqa: BLE001
        audit.record(None, "error", f"{request.method} {path}", f"unhandled: {e}"[:200], status="error", ms=int((_t.time() - t0) * 1000))
        raise
    kind = "a2a" if path.startswith("/a2a/") else "api"
    audit.record(None, kind, f"{request.method} {path}", f"HTTP {resp.status_code}", status="ok" if resp.status_code < 400 else "error",
                 ms=int((_t.time() - t0) * 1000))
    return resp


@app.on_event("startup")
def _startup() -> None:
    init_db()
    tracing.init()


@app.exception_handler(InputRejected)
def _rejected(_, e: InputRejected):
    return Response(
        content=f'{{"detail":"{str(e)}"}}',
        status_code=422,
        media_type="application/json",
    )


@app.exception_handler(GuardrailViolation)
def _guard(_, e: GuardrailViolation):
    import json as _j

    return Response(content=_j.dumps({"detail": f"Blocked by SkillOra guardrails: {e}", "kind": e.kind}), status_code=422, media_type="application/json")


from app.config import A2A_ENABLED  # noqa: E402

_a2a_app = None
if A2A_ENABLED:  # ADK Resume Writer served over the A2A protocol (requirement 6)
    from app.a2a.server import build_app

    _a2a_app = build_app()


@app.on_event("startup")
async def _start_a2a() -> None:
    # Starlette only builds the A2A routes in the sub-app's lifespan, which FastAPI does not run for mounted apps.
    if _a2a_app is not None:
        app.state.a2a_ctx = _a2a_app.inner.router.lifespan_context(_a2a_app.inner)
        await app.state.a2a_ctx.__aenter__()


# Mount modular routers
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(sources_router)
app.include_router(facts_router)
app.include_router(jobs_router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "SkillOra API",
        "version": "1.0",
        "docs": "/docs",
    }


if _a2a_app is not None:
    app.mount("/", _a2a_app)  # last: serves /a2a/writer/... (card + JSON-RPC); everything else is handled above
