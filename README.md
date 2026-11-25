# AI Chatbot

A full-stack conversational AI application built with React, FastAPI, LiteLLM, and SQLite. The application supports multi-turn conversations, LLM API key failover, response caching, session history persistence, and request-level usage metadata.

## Live Application

| Component | URL |
|---|---|
| Frontend | https://llm-chatbot-flax.vercel.app |
| Backend API | https://llm-chatbot-production-90e558b6.up.railway.app |
| Health Check | https://llm-chatbot-production-90e558b6.up.railway.app/health |

## Features

- **Conversational Chat Interface:** React-based interface supporting multi-turn conversations and session management.
- **Session Persistence:** Conversation history is stored in SQLite and can be retrieved using a session ID.
- **LLM Integration:** LiteLLM provides a unified interface for interacting with configured language models.
- **API Key Failover:** Supports multiple LLM API keys and automatic fallback when configured provider requests encounter eligible failures.
- **Response Caching:** Uses LiteLLM's built-in caching to avoid repeated inference for matching requests.
- **Response Metadata:** Displays model information, resolution source, latency, and input/output token usage.
- **Failure Simulation:** Supports request-level failure simulation through the `X-Simulate-Failure` header when enabled.
- **Containerization:** Dockerfiles and Docker Compose configuration support local containerized execution.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| LLM Integration | LiteLLM |
| Database | SQLite |
| ORM | SQLAlchemy |
| Testing | Pytest |
| Frontend Testing | ESLint, custom integration test |
| Containerization | Docker, Docker Compose |
| Frontend Deployment | Vercel |
| Backend Deployment | Railway |

## Project Structure

```text
ai-chatbot/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── repositories/
│   │   └── services/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   └── services/
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Makefile
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10 or newer
- Node.js and npm
- Docker and Docker Compose (for containerized execution)
- At least two valid API keys for the configured LLM provider

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd ai-chatbot
```

### 2. Environment configuration

Copy the backend environment template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the required environment variables:

```env
LLM_API_KEYS=<your-api-keys>
DATABASE_URL=sqlite:///./app.db
ALLOWED_ORIGINS=http://localhost:3000
ENABLE_FAILURE_SIMULATION=true
```

Use the exact API key format documented in `.env.example`.

Never commit real API keys or other secrets.

### 3. Run without Docker

**Backend**

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

**Frontend**

Open a second terminal:

```bash
cd frontend
npm ci
```

Copy the frontend environment template:

```bash
cp .env.example .env
```

Configure the backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at the Vite development URL shown in the terminal.

### 4. Run with Docker Compose

From the repository root, configure the required backend environment variables in `.env`.

Build and start the application:

```bash
make up
```

This starts the frontend and backend using Docker Compose.

Expected local endpoints:

| Component | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Health Check | http://localhost:8000/health |

To stop the application:

```bash
make down
```

The SQLite database uses a Docker named volume mounted at `/data`.

The containerized database configuration is:

```env
DATABASE_URL=sqlite:////data/app.db
```

The named volume allows database files to persist across container restarts.

## API Endpoints

