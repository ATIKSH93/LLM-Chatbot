#AI Chatbot

A React and FastAPI chatbot. The frontend sends each new message to the backend; the backend assembles session history, calls the configured LiteLLM model, and stores successful turns in SQLite.

## Project layout

- `backend/` — FastAPI routes, LiteLLM service, SQLAlchemy models/repository, and pytest suite.
- `frontend/` — React/Vite chat interface and its API client.
- `.env.example` — backend environment template.
- `frontend/.env.example` — frontend API URL template.
- `backend/docs/api_contract.md` — endpoint and response contract.
- `my-docs/` — local project handoffs; this directory is intentionally ignored by Git.

## Requirements

- Python 3.10 or newer, with the backend requirements installed.
- Node.js and npm, with the frontend dependencies installed using `npm ci` from `frontend/`.
- Two or more API keys for the configured LLM provider to pass the health check and exercise provider fallback.

## Local setup

1. Copy `.env.example` to `.env` and set `LLM_API_KEYS` locally. Keep real credentials out of source control.
2. Install backend dependencies from `backend/` with `python -m pip install -r requirements.txt`.
3. Start the backend from `backend/` with `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.
4. Copy `frontend/.env.example` to `frontend/.env` if the backend is not at the default URL.
5. From `frontend/`, run `npm ci` and `npm run dev`.

The default backend database is `sqlite:///./app.db`. Set `DATABASE_URL` to another SQLAlchemy URL when needed; for a future container volume the intended SQLite URL is `sqlite:////data/app.db`. The backend creates its schema at startup. `ALLOWED_ORIGINS` accepts a comma-separated list of browser origins. `ENABLE_FAILURE_SIMULATION` controls the request-scoped `X-Simulate-Failure` test header.

## Verification

From `backend/`, run `python -m pytest -q`.

From `frontend/`, run `npm run lint`, `npm run build`, and `node test_phase4.mjs`.

The automated backend tests mock model completions. The frontend integration script uses a local mock server. Neither command verifies live provider credentials.

## Current phase

Phases 1–4 are implemented. Docker packaging, deployment, and public deployment URLs have not been added or claimed here.
