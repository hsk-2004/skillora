# SkillOra — AI-Powered Resume Intelligence & Job Readiness

> **One verified profile. Every resume tailored. Every score explained.**

SkillOra is an agentic AI career platform that maintains a verifiable fact ledger of your real work (from GitHub repositories, documents, and notes), automatically tailors your resume for any job description without hallucinating, and calculates a deterministic, explainable ATS-style job-fit score.

---

## 👥 Team & Architecture Ownership

| Person | Core Focus | Backend Engine | Frontend Workspace |
|---|---|---|---|
| **Palak Bhatt** | Resume Tailoring Engine & Verification Guard | Google ADK (`LlmAgent`, Verifier callback) | `/tailor`, Coordinator Chat Drawer |
| **Manya Agarwal** | Profile Builder & Fact Ledger | CrewAI IngestFlow & Multimodal Parsers | `/sources`, `/verify` |
| **Vanshik Soni** | Job Description Analyzer & Matcher | CrewAI Flow & RapidFuzz 3-Tier Matcher | `/job` |
| **Harman Singh Kanwar** | Explainable Scoring Engine & Document Export | Plain Python Math Engine, `fpdf2`, `python-docx` | `/score`, `/export` |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker Desktop (for Postgres database)

### One-Click Launch (Windows)
Double-click in order:
```cmd
start-backend.bat     # Starts Postgres (port 5433), runs migrations, starts FastAPI on http://localhost:8000
start-frontend.bat    # Runs Next.js frontend on http://localhost:3000
```

### Manual Setup

1. **Database:**
   ```bash
   docker compose up -d db
   ```
   *(SQLite fallback is automatic if Docker is not running).*

2. **Backend:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt
   # one .env at the repo root serves backend + frontend
   cp ../.env.example ../.env   # add your GEMINI_API_KEY
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   * Interactive API docs: `http://localhost:8000/docs`

3. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   * App URL: `http://localhost:3000`

---

## 📐 System Architecture

| Stage | Technology | Implementation | Description |
|---|---|---|---|
| **1. Ingestion** | **CrewAI Flow** + `pdfplumber` / `python-docx` / `python-pptx` / GitHub API | `backend/app/agents/crew_flows.py`, `backend/app/parsers.py` | Extracts facts with quoted spans; deterministic span gate drops any ungrounded fact. |
| **2. JD Analysis** | **CrewAI Flow** + Local Rules | `backend/app/agents/crew_flows.py`, `backend/app/agents/rules.py` | Structures JD into must-have vs. nice-to-have requirements, seniority level, and company profile. |
| **3. Matching** | **RapidFuzz** + N-gram Cosine | `backend/app/engine/matching.py` | 3-tier matcher (Exact $\rightarrow$ Fuzzy token set $\rightarrow$ Semantic cosine similarity). |
| **4. Tailoring & Verifier** | **Google ADK** (`LlmAgent`) | `backend/app/agents/adk_agents.py`, `backend/app/engine/verify.py` | Drafts bullets citing fact IDs only; Verifier checks numbers, tools, and seniority against cited spans. |
| **5. Coordinator Chat** | **Google ADK** (Sub-agent + Tools) | `backend/app/agents/adk_agents.py`, `backend/app/orchestrator.py` | Chat assistant for real-time tailoring adjustments, score explanations, and project inclusion toggling. |
| **6. Scoring** | Deterministic Python Math | `backend/app/engine/scoring.py` | Explainable ATS formula ($S = w_K K + w_J J + w_E E + w_Q Q + w_A A$) across 4 configurable profiles. |
| **7. Export** | `fpdf2` & `python-docx` | `backend/app/export.py` | Preflight verification gate ensures only verified, grounded bullets are exported to PDF or DOCX. |

---

## 🛡️ Resilience & Dual-Mode Execution

* **Dual-Engine Backend:** Every agent pipeline attempts Gemini first. If Gemini returns 503 (high demand) or has no API key, it seamlessly falls back to deterministic rule-based engines in `app/agents/rules.py`. The active mode is surfaced in the UI.
* **Dual-Mode Frontend:** If the FastAPI backend is offline during a presentation, the frontend automatically falls back to bundled demo data (`frontend/lib/data.ts`) so UI interactions never break.
* **LLM Caching:** LLM outputs are cached by input hash in `llm_cache` table to cut latency to under 0.5s for repeated queries.

---

## 📊 Evaluation Runner

To run the deterministic evaluation benchmarks (extraction recall, requirement matching, score stability, fabrication catch rate):
```bash
cd backend
python -m eval.run_eval
```
Or call `GET /api/eval` via the API.

---

## 📁 Repository Structure

```
SkillOra/
├── assets/                     # Architecture diagrams and visuals
├── backend/
│   ├── app/
│   │   ├── activity.py         # Real-time execution telemetry
│   │   ├── auth.py             # User accounts, scrypt hashing, JWT tokens
│   │   ├── config.py           # Model chain configuration
│   │   ├── db.py               # SQLAlchemy 2.0 schema (User, Source, Fact, Job, LLMCache)
│   │   ├── export.py           # PDF (fpdf2) and DOCX resume generation
│   │   ├── llm.py              # Gemini client and JSON extraction
│   │   ├── main.py             # FastAPI application root & middleware
│   │   ├── orchestrator.py     # Agent bridge with fallback handling
│   │   ├── parsers.py          # Multimodal document, GitHub, zip & code folder parsers
│   │   ├── service.py          # Business logic and view transformations
│   │   ├── vocab.py            # Taxonomy and skill extraction regexes
│   │   ├── api/                # Modular REST routers (auth, sources, facts, jobs, system)
│   │   ├── agents/             # Google ADK & CrewAI agent definitions
│   │   └── engine/             # Matching, scoring, and verification engines
│   ├── eval/                   # Benchmark evaluation runner
│   ├── requirements.txt
└── .env.example   (single env for everything)
├── docs/                       # Project specifications, setup guides, and UI references
├── frontend/
│   ├── app/                    # Next.js App Router (Landing, How-it-Works, Login, Workflow)
│   │   └── (app)/              # Authenticated workspace: /sources, /verify, /job, /tailor, /score, /export
│   ├── components/             # AppShell, AgentPanel, ScoreRing, Ambient
│   ├── lib/                    # api.ts (typed client), store.tsx (state), data.ts (demo dataset)
│   └── package.json
├── docker-compose.yml          # PostgreSQL 16 Alpine container
├── start-backend.bat           # Windows launcher for backend
├── start-frontend.bat          # Windows launcher for frontend
└── Skillora-Presentation.pptx  # 8-slide project deck
```
