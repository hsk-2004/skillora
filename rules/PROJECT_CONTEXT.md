# Project Context

> Read at the start of every AI session. Update at the same time as the work, whenever decisions or implementation details change, including changes made by hand.

**Last updated**: 2026-10-25 by Antigravity / Palak Bhatt

## Overview
SkillOra is an agentic resume intelligence and verifiable career profile system designed to eliminate "hallucination drift" in generative career tools. Instead of inventing phantom metrics and unverified tech skills, SkillOra extracts source evidence into an immutable, character-indexed SQLite Fact Ledger, matches verified claims against job descriptions using CrewAI flows, and tailors ATS resumes using Google ADK with a real-time zero-hallucination verifier callback.

- **Course**: CSE3101 Agentic AI (Academic Milestone).
- **Team**: Palak (Lead & Architecture), Manya (Ingestion & Ledger), Vanshik (Job Analysis & Matcher), Harman (Scoring & ATS).
- **Current Milestone**: 60% Mid-Term Presentation (Stages 1–4 fully functional; Stages 5 & 6 gated for Phase 2).

## Tech Stack & Architecture
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide icons, GSAP animations.
- **Backend**: Python 3.11, FastAPI (asynchronous REST API), Uvicorn, SQLAlchemy ORM, Pydantic v2.
- **Databases**: SQLite (`backend/skillora.db` for local deterministic testing), PostgreSQL (via Docker Compose on port 5433).
- **Multi-Agent Frameworks (Strict Dual-Framework Exclusivity)**:
  - **CrewAI**: Orchestrator-workers for document parsing, job description requirement decomposition (`JobRequirement`), and cascading fuzzy/embedding matching.
  - **Google ADK**: Conversational resume tailoring, real-time bullet generation, and `verifier_callback` guardrail enforcement.
- **Model Context Protocol (MCP)**:
  - FastMCP server in `backend/app/mcp_server.py`, served over streamable HTTP and mounted at `/mcp/` (gated by `X-MCP-Key`, or loopback only when no key is set).
  - 4 tools that run the real project code: `file_parser_mcp`, `github_crawler_mcp`, `ledger_db_lookup_mcp`, `ats_calculator_mcp`. The user id comes from the `X-User-Id` header set by our code, never from a model argument.
  - Real MCP clients: the ADK Coordinator uses `ledger_db_lookup_mcp` and `ats_calculator_mcp` through `McpToolset` (`agents/adk_agents.py`, `_mcp_toolset`); the resume-upload and GitHub-source steps call `file_parser_mcp` / `github_crawler_mcp` through `backend/app/mcp_client.py`, falling back to the same code directly (and logging it) if the server is unreachable.
  - `GET /api/mcp/tools` (registry with who uses each tool and why, plus live call counts), `POST /api/mcp/ping` (a real tool call). Every call is logged as audit kind `mcp` (Live Logs "MCP" filter).
  - Frontend page `/mcp` explains it; settings `MCP_ENABLED`, `MCP_URL`, `MCP_SHARED_KEY` in `.env`.

## Component Conventions
- Shared layout and core UI live in `frontend/components/`:
  - `AppShell.tsx`: Navigation bar, top stage progress bar (Stages 1–4), user session, telemetry drawer toggle, and 11 requirements modal toggle.
  - `AgentPanel.tsx`: Telemetry drawer displaying agent execution hops, elapsed milliseconds, and active framework.
  - `RequirementsModal.tsx`: Evaluator-facing modal displaying all 11 syllabus evaluation criteria with live MCP ping and benchmark metrics.
  - `ScoreRing.tsx`: Circular SVG gauge for ATS score visualization (used in score views).
  - `Ambient.tsx`: Subtle ambient background orbs.
- Design Tokens: Warm cream canvas (`#FAF9F5`), forest emerald primary (`#1E6B38`), slate neutral text (`#141A16`), soft mint badges (`#EAF4EB`, border `#C5E1CB`), serif headings (`font-serif`) with Inter sans body.

## Finalised Design Decisions
- Strict Dual-Framework Exclusivity: CrewAI for pipeline workflows, Google ADK for live tailoring (`D-001`).
- Verifiable SQLite Fact Ledger with immutable character-span citations (`D-002`).
- 60% Mid-Term Presentation Scope: Stages 1–4 live; Stages 5 & 6 commented out in UI, preserved on disk (`D-003`).
- Official Anthropic Model Context Protocol (FastMCP) integration with live endpoint (`D-004`).
- Complete Removal of Seed/Mock Data for Live Presentation (`D-005`).
- Landing Page Navigation: Home, How It Works, Pricing, Resources with generous spacing and interactive modals (`D-006`).
- On-Screen 11 Requirements Matrix & Live Evaluator Modal for faculty presentation (`D-007`).
- Structured 4-Block Fact Ledger & Persistent Candidate Profile (`D-008`).
- Interactive Project Cards Grid with Add/Edit/Delete Controls (`D-009`).

## Implementation Details for Future Sessions
- **Environment & Secrets**: `backend/.env` holds `GEMINI_API_KEY`, `GITHUB_TOKEN`, `JWT_SECRET`, and `DB_URL`. This file is git-ignored via `.gitignore`.
- **GitHub Ingestion**: `backend/app/parsers.py` calls the GitHub REST API v3 with Bearer token authentication to crawl READMEs, language statistics, and dependency files without unauthenticated rate limits.
- **Evaluation Harness**: `python backend/eval/run_eval.py` executes synthetic gold-standard benchmark testing (100% Fact Recall, 100% Span Validity, 100% Fabrication Catch Rate, ~2.0s latency).
- **Backend Health**: `GET /api/health` returns `{"status":"ok", "mcp":"active", "mcp_tools":4}`.

## Project Commands
- **Frontend Dev**: `npm run dev` (in `frontend/`, runs on `http://localhost:3000`)
- **Backend Dev**: `uvicorn app.main:app --reload --port 8000` (in `backend/`, runs on `http://127.0.0.1:8000`)
- **Typecheck**: `npx tsc --noEmit` (in `frontend/`)
- **Evaluation Benchmark**: `python backend/eval/run_eval.py`
- **Docker Multi-Container**: `docker compose up --build`

## Known Issues & Constraints
- **Framework Constraint**: No LangChain, AutoGen, or unapproved wrappers may be introduced. Must strictly adhere to CrewAI and Google ADK exclusively.
- **Workflow Journey**: All 6 stages are active in `AppShell.tsx`: 1: Sources, 2: Fact Ledger, 3: Job Match, 4: Score & ATS, 5: Tailor & Chat, 6: Export. Direct workflow links allow candidates to jump directly from Sources to Job Match to Score & Breakdown, while all pages remain inspectable for faculty.
- **PowerShell Execution**: In Windows PowerShell, use `;` to chain commands, never `&&`.
- **Tailwind v4 Spacing**: Inline flex elements must have explicit flex styles (`display: "flex", gap: "24px"`) and margins to prevent text squishing across browser rendering engines.

## Open Questions
- **LangFuse Tracing**: Cloud instance API key and host URL configuration for Phase 2 distributed tracing.
- **Cloud Deployment**: Selecting target cloud host (Google Cloud Run vs Render) for Phase 2 live public deployment.

## Recent Manual Changes
- 2026-10-26: User specified persistent candidate profile foundation + two-input resume matching workspace (`D-012`).
- 2026-10-26: User specified dual-experience model: simple user workflow + technical view for faculty (`D-011`).
- 2026-10-26: User requested simplified user journey while preserving existing UI & landing page (`D-010`).
- 2026-10-26: User requested project cards grid with Add/Edit/Delete in Fact Ledger (`D-009`).
- 2026-10-26: User requested 4-block Fact Ledger structure & persistent candidate profile (`D-008`).
- 2026-10-25: User requested removal of all mock/dummy data across screens and database tables (`D-005`).
- 2026-10-25: User requested updating landing page navbar to "Home, How It Works, Pricing, Resources" with generous spacing (`D-006`).
- 2026-10-25: User requested on-screen presentation of all 11 evaluation requirements (`D-007`).
