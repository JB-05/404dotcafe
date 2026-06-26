# Deploy to Vercel (testing)

**Vercel hosts the Next.js frontend only.** The FastAPI API must run somewhere public (Render free tier is the quickest option below).

## Architecture

```text
Vercel (frontend)  ──HTTPS──►  Render / VPS (FastAPI + Postgres)
         │                              │
    NEXT_PUBLIC_API_URL          FRONTEND_URL = your Vercel URL
```

---

## Step 1 — Push code to GitHub

Commit and push `main` so Vercel can build from the repo.

---

## Step 2 — Deploy the API (pick one)

### Option A — Render (recommended for testing)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect repo `404dotcafe`
3. Render reads `render.yaml` (Postgres + API container)
4. On each deploy/start, the container automatically runs migrations **and** seeds (menu + inventory). No Render Shell needed on the free tier.

   **Optional — seed from your PC** if the API is up but the menu is empty:

   1. Render → **cafeos-db** → **Connections** → copy **External Database URL**
   2. Locally (PowerShell):

   ```powershell
   cd backend
   .venv\Scripts\activate
   $env:DATABASE_URL = "postgresql+asyncpg://..."  # paste URL; postgres:// also works
   python ..\scripts\seed_menu.py
   python ..\scripts\seed_inventory.py
   ```

5. Set **FRONTEND_URL** on the API service to your Vercel URL (step 3)
6. Copy the API URL, e.g. `https://cafeos-api.onrender.com`

**Note:** Free Render services sleep after ~15 min idle; first request may take 30–60s.

### Option B — Keep API local + ngrok (quick UI-only test)

```bash
# Terminal 1 — backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — tunnel
ngrok http 8000
```

Use the `https://….ngrok-free.app` URL as `NEXT_PUBLIC_API_URL` in Vercel.

---

## Step 3 — Deploy frontend on Vercel

### Option A — Root Directory (recommended)

1. Vercel → your project → **Settings** → **General**
2. **Root Directory** → `frontend` (exactly — no `./`, no trailing slash)
3. **Settings** → **Build and Deployment** — turn **OFF** all overrides:

   | Setting | Value |
   |---------|--------|
   | Framework Preset | Next.js |
   | Build Command | *(Override OFF — default `npm run build`)* |
   | Install Command | *(Override OFF — default `npm install`)* |
   | **Output Directory** | *(Override OFF — must NOT be `client/dist`)* |

   The `client/dist` error means an old Vite setting is still enabled. **Delete** any value in Output Directory and disable the override toggle.

4. **Deployments** → **Redeploy**

There must be **no** `vercel.json` at the repo root (only `frontend/vercel.json`). A root file with `npm install --prefix frontend` breaks when Root Directory is already `frontend`.

### Option B — Repo root (not recommended)

Only use if Root Directory is blank. Do not combine repo-root config with Root Directory = `frontend`.

### Env vars and deploy

1. **Environment variables** (Production + Preview):

   | Name | Example |
   |------|---------|
   | `NEXT_PUBLIC_API_URL` | `https://cafeos-api.onrender.com` |
   | `NEXT_PUBLIC_WS_URL` | `wss://cafeos-api.onrender.com` |

4. **Deploy**

5. Open `https://your-project.vercel.app/menu` — menu should load from the API.

---

## Step 4 — Wire CORS

On the API host, set:

```env
FRONTEND_URL=https://your-project.vercel.app
```

Redeploy/restart the API. Vercel preview URLs (`*.vercel.app`) are already allowed via regex in `backend/main.py`.

---

## Step 5 — Smoke test

| URL | Check |
|-----|--------|
| `/menu` | Categories load |
| `/checkout` | Place order |
| `/login` | Staff login |
| `/pos` | Mark paid |
| `/kitchen` | Order appears |
| `/admin` | Dashboard loads |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **ENOENT `frontend/frontend/package.json`** | Root Directory is `frontend` but install command still uses `--prefix frontend`. Delete repo-root `vercel.json`; disable Install Command override in Vercel. |
| **`client/dist` not found** | Turn **OFF** Output Directory override in Build settings (legacy Vite path). |
| **No Next.js version detected** | Root Directory must be `frontend`. |
| Menu empty / network error | Wrong `NEXT_PUBLIC_API_URL`; API asleep (Render free tier); wait for redeploy after push (seeds run on startup) |
| Empty menu after deploy | Redeploy API service, or run seeds locally with Render **External Database URL** (see Step 2) |
| CORS error in browser | Set `FRONTEND_URL` on backend to exact Vercel URL |
| WebSocket fails | Use `wss://` not `ws://`; Render supports WebSockets |
| 404 on `/pos`, `/admin` | Root Directory must be `frontend` (not repo root) |
| Build runs legacy `client/` | Set Root Directory = `frontend` |

---

## Production later

Replace Render with a VPS (`docs/CAFEOS_EXECUTION_PLAN.md` Step 13), custom domains `menu.404cafe.in` + `api.404cafe.in`, change staff passwords, strong `JWT_SECRET`.
