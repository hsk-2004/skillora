# Deploying SkillOra on Railway (requirement 11)

One Railway project, three services:

| Service | Source | Notes |
|---|---|---|
| **Postgres** | Railway "Database -> PostgreSQL" | gives `DATABASE_URL` |
| **backend** | this repo, root dir `/`, Dockerfile `backend.Dockerfile` (`railway.json`) | FastAPI + A2A server |
| **frontend** | this repo, root dir `/`, Dockerfile `frontend.Dockerfile` | Next.js |

## Backend variables
```
GEMINI_API_KEY=...            GEMINI_MODEL=gemini-3.1-flash-lite
DB_URL=postgresql+psycopg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
JWT_SECRET=<long random string>
PUBLIC_URL=https://<backend-domain>.up.railway.app     # the A2A agent card advertises this
CORS_ORIGINS=https://<frontend-domain>.up.railway.app
A2A_ENABLED=1                 A2A_SHARED_KEY=<random>
LANGFUSE_PUBLIC_KEY=...       LANGFUSE_SECRET_KEY=...      LANGFUSE_HOST=https://cloud.langfuse.com
```
## Frontend variables
```
NEXT_PUBLIC_API_URL=https://<backend-domain>.up.railway.app     # build-time: set before the first build
```
Generate a public domain for both services (Settings -> Networking), then redeploy so `PUBLIC_URL` / `NEXT_PUBLIC_API_URL` take effect.
Verify: `GET /api/health`, `GET /a2a/writer/.well-known/agent-card.json`, and a trace appearing in Langfuse after a tailoring run.
