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

1. [vercel.com](https://vercel.com) → your project → **Settings** → **General**
2. **Root Directory** → **Edit** → type exactly: `frontend` (no `./`, no slash at end)
3. Save → **Deployments** → **Redeploy**
4. Under **Build & Development**: Framework = **Next.js**, Output Directory = **empty**

### Option B — Repo root (fallback)

If Root Directory cannot be set, push the root `vercel.json` (builds `frontend/package.json` via `@vercel/next`). Redeploy after push.

### Either way — env vars and deploy

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
| **No Next.js version detected** | Root Directory is not `frontend`. Settings → General → Root Directory → `frontend` → Redeploy. |
| **Build failed: `client/dist` / no entrypoint** | Same fix — Root Directory must be `frontend`, not repo root. |
| Menu empty / network error | Wrong `NEXT_PUBLIC_API_URL`; API asleep (Render free tier); wait for redeploy after push (seeds run on startup) |
| Empty menu after deploy | Redeploy API service, or run seeds locally with Render **External Database URL** (see Step 2) |
| CORS error in browser | Set `FRONTEND_URL` on backend to exact Vercel URL |
| WebSocket fails | Use `wss://` not `ws://`; Render supports WebSockets |
| 404 on `/pos`, `/admin` | Root Directory must be `frontend` (not repo root) |
| Build runs legacy `client/` | Set Root Directory = `frontend` |

---

## Production later

Replace Render with a VPS (`docs/CAFEOS_EXECUTION_PLAN.md` Step 13), custom domains `menu.404cafe.in` + `api.404cafe.in`, change staff passwords, strong `JWT_SECRET`.
