# CafeOS

Full-stack café management platform for **404 Café** — Phase 1 MVP.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js · TypeScript · Tailwind · TanStack Query · Zustand |
| Backend | FastAPI · SQLAlchemy · Alembic · PostgreSQL |
| Realtime | Redis · WebSockets (Step 7) |
| Jobs | Celery (Step 8) |

## Project layout

```text
backend/          FastAPI API
frontend/         Next.js app (deploy to Vercel)
infra/            Docker Compose (Postgres + Redis)
scripts/          Seed & migration helpers
docs/             PRD analysis + execution plan
client/           LEGACY — old Vite prototype (do not extend)
server.js         LEGACY — old Express API
```

## Quick start

### 1. Prerequisites

- Node.js 20+
- Python 3.12+
- Docker Desktop (for Postgres + Redis)

### 2. Start database

```bash
cd infra
docker compose up -d postgres redis
```

### 3. Backend

```bash
# One-time setup (creates isolated venv — avoids global pydantic v1 conflicts)
scripts\setup-backend.bat

# Activate venv (Windows)
backend\.venv\Scripts\activate
cd backend

cp .env.example .env   # or: copy .env.example .env
alembic upgrade head
python ../scripts/seed_menu.py
uvicorn main:app --reload
```

API: http://localhost:8000  
Health: http://localhost:8000/health  
Menu: http://localhost:8000/api/v1/menu

### 4. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

App: http://localhost:3000/menu

### 5. Default staff accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@404cafe.in | admin123 |
| Staff | staff@404cafe.in | staff123 |
| Kitchen | kitchen@404cafe.in | kitchen123 |

Change these before production.

## Deploy

### Vercel (frontend — testing)

See **[docs/VERCEL_TESTING.md](docs/VERCEL_TESTING.md)**.

**Critical:** In Vercel project settings, set **Root Directory** to `frontend`. Without this, the build fails (`No Next.js version detected` or `client/dist` errors).

### Production

- **Frontend:** Vercel + custom domain `menu.404cafe.in`
- **Backend:** VPS + Docker (see `docs/CAFEOS_EXECUTION_PLAN.md` Step 13)

## Docs

- [MVP Analysis](docs/CAFEOS_MVP_ANALYSIS.md)
- [Execution Plan](docs/CAFEOS_EXECUTION_PLAN.md)
- [Decisions](docs/DECISIONS.md)

## Current progress

- [x] Monorepo scaffold
- [x] FastAPI + auth + menu API
- [x] DB schema + migrations + seed
- [x] Next.js menu + cart + checkout shell
- [x] Order creation API (Step 5)
- [x] Customer checkout + order tracking (PENDING_PAYMENT)
- [x] POS + payment verification (Step 6)
- [ ] Kitchen + WebSockets (Step 7)
- [ ] Invoices (Step 8)
- [ ] Inventory + finance (Step 9–10)
