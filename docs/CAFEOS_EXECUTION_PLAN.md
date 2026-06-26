# CafeOS — Step-by-Step Execution Plan

**Purpose:** Actionable playbook to migrate from the current 404 Café MERN prototype to the full CafeOS Phase 1 MVP, including build order, hosting setup, and cutover strategy.

**Companion docs:**
- Master PRD (product spec)
- [`CAFEOS_MVP_ANALYSIS.md`](./CAFEOS_MVP_ANALYSIS.md) (engineering analysis)

**Estimated timeline:** 10–12 weeks (1 developer) · 6–8 weeks (2 developers)

---

## Table of Contents

1. [Pre-flight decisions](#step-0-pre-flight-decisions-day-1)
2. [Repository & migration strategy](#step-1-repository--migration-strategy-days-1-2)
3. [Local development environment](#step-2-local-development-environment-days-2-3)
4. [Backend foundation](#step-3-backend-foundation-week-1)
5. [Frontend foundation](#step-4-frontend-foundation-week-1-2)
6. [Customer ordering flow](#step-5-customer-ordering-flow-week-2-3)
7. [Payment & POS](#step-6-payment--pos-week-3-4)
8. [Kitchen & realtime](#step-7-kitchen--realtime-week-4-5)
9. [Order tracking & invoices](#step-8-order-tracking--invoices-week-5-6)
10. [Inventory system](#step-9-inventory-system-week-6-7)
11. [Admin & financial analytics](#step-10-admin--financial-analytics-week-7-8)
12. [PWA, polish & hardening](#step-11-pwa-polish--hardening-week-8-9)
13. [Staging deployment](#step-12-staging-deployment-week-9)
14. [Production hosting setup](#step-13-production-hosting-setup-week-9-10)
15. [Data migration & cutover](#step-14-data-migration--cutover-week-10)
16. [Legacy repo wind-down](#step-15-legacy-repo-wind-down-week-10-11)
17. [Post-launch operations](#step-16-post-launch-operations-ongoing)
18. [Master checklist](#master-checklist)

---

## Strategy Summary

```text
CURRENT (Website repo)              TARGET (CafeOS repo)
─────────────────────               ────────────────────
React + Vite                   →    Next.js 15 + TypeScript
Express + MongoDB              →    FastAPI + PostgreSQL
No auth                        →    JWT + roles
3 order statuses               →    7-state machine
Vercel (broken API)            →    Vercel frontend + VPS backend
```

**Do not refactor in place.** Create a fresh monorepo, migrate assets, run both systems briefly in parallel, then cut over.

---

## Step 0: Pre-flight Decisions (Day 1)

Complete these before writing code. Document answers in `docs/DECISIONS.md`.

| # | Decision | Recommended choice | Your answer |
|---|----------|-------------------|-------------|
| D-01 | New repo or rename current? | **New repo** `cafeos` (keep `Website` as archive) | |
| D-02 | Domain structure | `menu.404cafe.in` (customer) · `app.404cafe.in` (staff) or single domain with routes | |
| D-03 | Order token format | `404-000123` (sequential per day) | |
| D-04 | Table number | Optional field on order (keep from current UX) | |
| D-05 | Tax model | CGST 2.5% + SGST 2.5% (match current app + India GST) | |
| D-06 | UPI QR | Static image of café UPI ID; amount shown as text beside QR | |
| D-07 | Invoice delivery MVP | Email + download link first; WhatsApp in Phase 1b | |
| D-08 | Email provider | Resend or Brevo (free tier) | |
| D-09 | VPS provider | Hetzner / DigitalOcean / Hostinger (₹1500–3000/mo) | |
| D-10 | Object storage | Cloudflare R2 (free egress) | |
| D-11 | JWT storage | HTTP-only secure cookies | |
| D-12 | Staff device plan | 1 POS tablet + 1 kitchen display minimum | |

**Exit criteria:** All 12 decisions recorded. Team aligned on scope.

---

## Step 1: Repository & Migration Strategy (Days 1–2)

### 1.1 Create the new monorepo

```bash
# On your machine
mkdir cafeos && cd cafeos
git init

mkdir -p frontend backend scripts docs infra
```

### 1.2 Initialize repo structure

```text
cafeos/
├── frontend/                 # Next.js 15
├── backend/                  # FastAPI
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
│       └── cafeos.conf
├── scripts/
│   ├── seed_menu.py          # migrated from seed.js
│   └── export_legacy_menu.js
├── docs/
│   ├── CAFEOS_MVP_ANALYSIS.md
│   ├── CAFEOS_EXECUTION_PLAN.md
│   └── DECISIONS.md
├── .env.example
├── .gitignore
└── README.md
```

### 1.3 Export assets from the current `Website` repo

Run from the **old** repo root:

| Asset | Source | Destination in CafeOS |
|-------|--------|----------------------|
| Menu data | `seed.js` / `data/menu.json` | `scripts/seed_menu.py` input JSON |
| Design tokens | `client/src/index.css` `:root` vars | `frontend/tailwind.config.ts` theme |
| Brand copy | `client/src/App.jsx` receipt section | `frontend/lib/brand.ts` |
| Food images | `client/public/images/` (add if missing) | Upload to R2 → DB `image_url` |
| Icons | `client/public/icons.svg` | `frontend/public/` |
| UX reference | `client/src/App.jsx` | Reference only — rewrite in Next.js |

**Export script** (create in old repo):

```bash
node scripts/export_legacy_menu.js > ../cafeos/scripts/legacy_menu.json
```

### 1.4 Archive the old repo

1. Create git branch `archive/mern-prototype` on `Website` repo
2. Add `README.md` banner: *"Superseded by CafeOS — see [link]"*
3. Do **not** delete yet — keep until production cutover is verified

**Exit criteria:** New `cafeos` repo exists on GitHub. Menu JSON exported. Old repo tagged/archived.

---

## Step 2: Local Development Environment (Days 2–3)

### 2.1 Install local prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| Python | 3.12 |
| Docker Desktop | Latest |
| pnpm | Latest (frontend) |
| uv or pip | Python deps |

### 2.2 Create `infra/docker-compose.yml`

Services for local dev:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: cafeos
      POSTGRES_PASSWORD: cafeos
      POSTGRES_DB: cafeos
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  # backend + celery added in Step 3
volumes:
  pgdata:
```

```bash
cd infra && docker compose up -d postgres redis
```

### 2.3 Create `.env.example` (root)

```env
# Database
DATABASE_URL=postgresql+asyncpg://cafeos:cafeos@localhost:5432/cafeos

# Redis
REDIS_URL=redis://localhost:6379/0

# Auth
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=7

# App
CAFE_ID=1
CAFE_NAME=404 Café
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Storage (R2) — fill later
R2_ENDPOINT=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=cafeos

# Email — fill later
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=orders@404cafe.in

# UPI
UPI_ID=cafe@upi
UPI_QR_IMAGE_URL=
```

### 2.4 Copy env files

```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
# frontend needs:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/orders
```

**Exit criteria:** `docker compose up` runs Postgres + Redis. `.env` files configured.

---

## Step 3: Backend Foundation (Week 1)

### 3.1 Scaffold FastAPI project

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic pydantic-settings python-jose passlib[bcrypt] redis celery websockets
```

### 3.2 Create folder structure

```text
backend/
├── api/
│   └── v1/
│       ├── router.py
│       ├── auth.py
│       └── menu.py
├── core/
│   ├── config.py
│   ├── database.py
│   └── security.py
├── models/
├── schemas/
├── services/
├── repositories/
├── workers/
├── alembic/
└── main.py
```

### 3.3 Database migrations — Phase A tables

Create Alembic migration for:

1. `users`
2. `menu_categories`
3. `menu_items`
4. `cafes` (single row for 404 Café)

```bash
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

### 3.4 Implement auth

| Task | Detail |
|------|--------|
| Password hashing | bcrypt via passlib |
| Login endpoint | `POST /api/v1/auth/login` |
| Refresh endpoint | `POST /api/v1/auth/refresh` |
| JWT middleware | Role extraction from token |
| Seed admin user | `admin@404cafe.in` via script |

### 3.5 Implement menu API

| Endpoint | Detail |
|----------|--------|
| `GET /api/v1/menu` | Public; categories + items + availability |
| `POST /api/v1/admin/menu/items` | Admin only (later) |

### 3.6 Seed menu from legacy data

```bash
python scripts/seed_menu.py --input scripts/legacy_menu.json
```

Map fields:
- `itemId` → slug or external_id
- `category` → `menu_categories.name`
- `customizations` → store as JSONB on `menu_items` for MVP

### 3.7 Add backend to Docker Compose

```yaml
  backend:
    build: ../backend
    ports: ["8000:8000"]
    env_file: ../backend/.env
    depends_on: [postgres, redis]
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3.8 Verify

```bash
curl http://localhost:8000/api/v1/menu
curl -X POST http://localhost:8000/api/v1/auth/login -d '{"email":"...","password":"..."}'
```

**Exit criteria:** Auth works. Menu returns seeded 404 Café items. Migrations run clean.

---

## Step 4: Frontend Foundation (Week 1–2)

### 4.1 Scaffold Next.js

```bash
cd frontend
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir
pnpm add @tanstack/react-query zustand framer-motion
pnpm dlx shadcn@latest init
```

### 4.2 Configure Tailwind theme from legacy design

Port CSS variables from `client/src/index.css`:

```ts
// tailwind.config.ts — example tokens
colors: {
  paper: { light: '#ebd0ad', mid: '#dfba8d' },
  chalkboard: '#111110',
  accent: '#c8742b',
}
```

Fonts: Bebas Neue, Outfit, Permanent Marker, Special Elite (Google Fonts).

### 4.3 Create app layout and route shells

| Route | File | Auth |
|-------|------|------|
| `/menu` | `app/menu/page.tsx` | Public |
| `/checkout` | `app/checkout/page.tsx` | Public |
| `/order/[id]` | `app/order/[id]/page.tsx` | Public |
| `/pos` | `app/pos/page.tsx` | STAFF |
| `/kitchen` | `app/kitchen/page.tsx` | KITCHEN |
| `/admin` | `app/admin/layout.tsx` | ADMIN |
| `/login` | `app/login/page.tsx` | Public |

### 4.4 Shared frontend infrastructure

| Component | Purpose |
|-----------|---------|
| `lib/api.ts` | Fetch wrapper with auth + error handling |
| `providers/QueryProvider.tsx` | TanStack Query |
| `stores/cart.ts` | Zustand cart (sessionStorage persist) |
| `hooks/useAuth.ts` | Login state + role |
| `components/ui/*` | shadcn components |

### 4.5 Auth middleware

```ts
// middleware.ts — protect /pos, /kitchen, /admin
```

### 4.6 Deploy preview to Vercel (early)

1. Connect `cafeos` GitHub repo to Vercel
2. Set **Root Directory:** `frontend`
3. Set env: `NEXT_PUBLIC_API_URL` → staging API URL (add later)
4. Confirm build passes

**Exit criteria:** Next.js runs locally. `/menu` renders shell. Vercel preview deploy works.

---

## Step 5: Customer Ordering Flow (Week 2–3)

Build the first end-to-end vertical slice.

### 5.1 Backend — orders schema (Phase B tables)

Add migrations:

- `orders`
- `order_items`
- `payments` (schema only; used in Step 6)

### 5.2 Backend — order service

Implement `OrderService`:

```text
create_order(customer, items, notes)
  → validate items exist + available
  → calculate prices server-side (NEVER trust client total)
  → calculate CGST + SGST
  → generate order_number (404-000123)
  → status = PENDING_PAYMENT
  → return order
```

Add idempotency:

- Accept `Idempotency-Key` header
- Store in Redis with 24h TTL
- Return existing order if key seen

### 5.3 Backend — endpoints

| Method | Path | Detail |
|--------|------|--------|
| POST | `/api/v1/orders` | Create order |
| GET | `/api/v1/orders/{id}` | Public order status |

### 5.4 Frontend — `/menu`

| Task | Detail |
|------|--------|
| Fetch menu | TanStack Query → `GET /menu` |
| Category tabs | Burgers, Drinks, Desserts, Add-ons |
| Item cards | Image, name, price, veg badge, availability |
| Item modal | Quantity, notes, add to cart |
| Cart badge | Zustand count |

Reuse UX patterns from legacy `App.jsx` but rebuild as components:

```text
components/menu/
  ├── CategoryNav.tsx
  ├── MenuItemCard.tsx
  ├── ItemModal.tsx
  └── CartDrawer.tsx
```

### 5.5 Frontend — `/checkout`

| Field | Required |
|-------|----------|
| Customer name | Yes |
| Phone | No |
| Email | No (needed for invoice — prompt if empty) |
| Table number | No |
| Order notes | No |

On submit → `POST /orders` → redirect to `/order/{id}`.

### 5.6 Test the vertical slice

```text
Browse menu → add items → checkout → order created in Postgres
```

**Exit criteria:** Customer can place an order. Order visible in DB with `PENDING_PAYMENT`. Prices match server calculation.

---

## Step 6: Payment & POS (Week 3–4)

### 6.1 Payment screen on `/order/[id]`

Show when status = `PENDING_PAYMENT`:

- Order token (e.g. `404-000123`)
- Total amount (large, prominent)
- Static UPI QR image
- UPI ID text
- "Waiting for payment confirmation" message

### 6.2 Backend — payment confirmation

| Method | Path | Detail |
|--------|------|--------|
| GET | `/api/v1/pos/orders` | List active orders (STAFF) |
| PATCH | `/api/v1/pos/orders/{id}/payment` | Mark PAID |
| PATCH | `/api/v1/pos/orders/{id}/cancel` | Cancel |

`mark_paid` transaction (atomic):

```text
BEGIN
  lock order row (SELECT FOR UPDATE)
  validate status == PENDING_PAYMENT
  update order_status → PAID, payment_status → PAID
  insert payment record (verified_by, timestamp)
  COMMIT
→ emit ORDER_PAID event
→ queue invoice Celery task (Step 8)
→ queue stock deduction (Step 9)
```

Use `version` column for optimistic locking — return 409 if stale.

### 6.3 Frontend — `/pos`

| Feature | Detail |
|---------|--------|
| Layout | Desktop-first table/card list |
| Sort | Unpaid first, oldest first |
| Card shows | Token, customer name, amount, elapsed time, status |
| Actions | "Mark Paid" (confirm dialog), "Cancel" |
| Auto-refresh | TanStack Query polling every 10s (WebSocket in Step 7) |

### 6.4 Staff login flow

- `/login` → role-based redirect:
  - STAFF → `/pos`
  - KITCHEN → `/kitchen`
  - ADMIN → `/admin`

**Exit criteria:** Staff can mark order paid. Status changes to PAID in DB. Customer order page updates.

---

## Step 7: Kitchen & Realtime (Week 4–5)

### 7.1 Backend — WebSocket gateway

```text
WS /ws/orders?token=<jwt>
  → authenticate + check role
  → subscribe to Redis channel cafeos:orders:1
  → on message, forward to client
```

Events: `ORDER_CREATED`, `ORDER_PAID`, `ORDER_STARTED`, `ORDER_READY`, `ORDER_COMPLETED`, `ORDER_CANCELLED`.

### 7.2 Backend — kitchen endpoints

| Method | Path | Detail |
|--------|------|--------|
| GET | `/api/v1/kitchen/orders` | Orders grouped by status |
| PATCH | `/api/v1/kitchen/orders/{id}/status` | Transition status |

Valid transitions:

- `PAID` → `IN_PREPARATION`
- `IN_PREPARATION` → `READY`
- `READY` → `COMPLETED`

### 7.3 Frontend — `/kitchen`

Three-column kanban:

```text
|  Paid Orders  |  Preparing  |  Ready  |
```

Each card: token, items, notes, elapsed timer.

Urgency colors:
- 0–5 min: default
- 5–10 min: yellow/warning
- 10+ min: red/critical

Actions: Start → Mark Ready → Complete.

### 7.4 Frontend — WebSocket hook

```ts
// hooks/useOrderSocket.ts
// - connect with JWT
// - auto-reconnect (exponential backoff, max 30s)
// - on event → invalidate TanStack Query caches
// - on reconnect → refetch full order list
```

### 7.5 Update POS + order tracking to use WebSocket

Remove polling where WS is available. Keep polling as fallback.

**Exit criteria:** New paid order appears on kitchen screen within 1 second. Status changes propagate to all dashboards in realtime.

---

## Step 8: Order Tracking & Invoices (Week 5–6)

### 8.1 Frontend — `/order/[id]` tracking UI

Progress stepper:

```text
Pending Payment → Paid → Preparing → Ready → Completed
```

Subscribe to WebSocket (public channel for order ID or polling every 5s).

### 8.2 Backend — invoice schema

Add tables: `invoices`.

### 8.3 Celery worker setup

```yaml
# docker-compose.yml
  celery:
    build: ../backend
    command: celery -A workers.celery_app worker -l info
    depends_on: [redis, postgres]

  celery-beat:
    build: ../backend
    command: celery -A workers.celery_app beat -l info
```

### 8.4 Invoice generation task

```text
on ORDER_PAID:
  Celery task generate_invoice(order_id)
    → build PDF (reportlab or weasyprint)
    → upload to R2
    → save invoice record with pdf_url
    → send email if customer_email present
    → (optional) send WhatsApp
```

**Never block the payment API** — queue only.

### 8.5 Invoice template contents

- 404 Café logo
- Invoice number (sequential)
- Order token
- Itemized list with CGST/SGST
- Total
- Timestamp
- UPI payment reference note

### 8.6 Customer download

On `/order/[id]`, when invoice exists: show "Download Invoice" button.

**Exit criteria:** Invoice PDF generates in background. Email sent. Download link works.

---

## Step 9: Inventory System (Week 6–7)

### 9.1 Database — Phase C tables

- `inventory_items`
- `menu_item_recipes`
- `stock_movements`

### 9.2 Admin — ingredient master

`/admin/inventory` — CRUD for ingredients:

- name, unit (kg / g / pcs), current_stock, threshold, cost_per_unit

### 9.3 Recipe mapping UI

`/admin/inventory/recipes` — map menu items to ingredients.

**Start with top 5 sellers** (e.g. Classic Chicken Burger, Mojito Ultra):

```text
Chicken Burger → bun: 1, patty: 1, cheese: 1, sauce: 20g
```

### 9.4 Stock deduction service

Hook into `mark_paid` transaction:

```text
for each order_item:
  for each recipe row:
    deduct quantity × order_qty
    insert stock_movement (reason: ORDER_FULFILLMENT, ref: order_id)
    if stock <= threshold → create alert
```

### 9.5 Low stock alerts

| Level | Condition |
|-------|-----------|
| Normal | stock > threshold |
| Low | stock ≤ threshold |
| Critical | stock ≤ 50% threshold |
| Out of stock | stock = 0 → mark menu item unavailable |

Show alerts on `/admin` overview.

### 9.6 Manual stock adjustment

`POST /api/v1/inventory/adjust`

- ingredient_id, quantity_change (+/-), reason (restock / spoilage / damage / correction)
- always logs to `stock_movements`

**Exit criteria:** Paying for a burger deducts bun + patty. Low stock alert fires. Admin can restock manually.

---

## Step 10: Admin & Financial Analytics (Week 7–8)

### 10.1 Database — Phase D tables

- `fixed_expenses`
- `variable_expenses`
- `daily_financial_snapshots`

### 10.2 Admin overview `/admin`

Today's metrics:

- Revenue
- Orders count
- Average order value
- Pending / completed orders
- Low stock count
- Net profit (once expenses exist)

Charts: hourly sales (bar), order volume (line).

### 10.3 Fixed expenses

`/admin/finance/fixed` — rent, salaries, internet, etc.

- billing_cycle: monthly / yearly
- daily normalized amount = monthly ÷ 30

### 10.4 Variable expenses

`/admin/finance/variable` — daily log: packaging, fuel, repairs, etc.

### 10.5 Finance service

```text
calculate_daily_pnl(date):
  revenue = sum(COMPLETED orders)
  cogs = sum(ingredient costs from stock_movements where reason=ORDER_FULFILLMENT)
  fixed = sum(normalized fixed expenses)
  variable = sum(variable expenses for date)
  gross_profit = revenue - cogs
  net_profit = revenue - (cogs + fixed + variable)
  profit_margin = (net_profit / revenue) × 100
```

### 10.6 Nightly Celery beat job

```text
0 23 * * * → compute daily_financial_snapshot for today
```

### 10.7 Break-even widget

```text
break_even_sales = daily_fixed_expenses / (1 - (cogs_per_rupee + variable_per_rupee))
```

Display on finance dashboard.

**Exit criteria:** Admin sees today's profit. Expenses can be logged. Nightly snapshot runs.

---

## Step 11: PWA, Polish & Hardening (Week 8–9)

### 11.1 PWA setup

```bash
pnpm add @ducanh2912/next-pwa
```

- Web manifest (`name: 404 Café Menu`)
- App icons (192, 512)
- Service worker caches menu API + static assets
- Install prompt on `/menu`

### 11.2 Error handling

| Area | Implementation |
|------|----------------|
| API errors | Toast notifications (shadcn Sonner) |
| WS disconnect | Banner: "Reconnecting..." |
| Order fail | Retry with same idempotency key |
| 404 pages | Branded not-found page |

### 11.3 Loading & empty states

Every dashboard needs skeleton loaders and empty state messages.

### 11.4 Security hardening

- [ ] CORS: only allow `FRONTEND_URL`
- [ ] Rate limit `POST /orders` (e.g. 10/min per IP)
- [ ] Input validation on all schemas (Pydantic)
- [ ] SQL injection: ORM only, no raw queries
- [ ] HTTPS everywhere in production
- [ ] Secrets in env vars, never in git

### 11.5 Load testing

Use `k6` or `locust`:

- 50 concurrent order submissions
- Verify no duplicate orders
- Verify all WS clients receive events
- Target: order creation < 500ms p95

### 11.6 Engineering constraints audit

Run through checklist in `CAFEOS_MVP_ANALYSIS.md` §11.

**Exit criteria:** PWA installable. Load test passes. Security checklist complete.

---

## Step 12: Staging Deployment (Week 9)

Deploy a full staging environment before production.

### 12.1 Staging VPS

- Smaller VPS is fine (2 vCPU, 4 GB)
- Subdomain: `api-staging.404cafe.in`

### 12.2 Staging services

```bash
# On staging VPS
git clone <cafeos-repo>
cd cafeos/infra
cp .env.staging .env
docker compose -f docker-compose.prod.yml up -d
```

### 12.3 Staging Vercel

- Branch: `develop` → staging preview
- `NEXT_PUBLIC_API_URL=https://api-staging.404cafe.in`

### 12.4 Staging verification script

Run through full flow manually:

```text
1. Customer orders 2 burgers on /menu
2. Checkout with name + email
3. Payment screen shows QR + token
4. POS marks paid
5. Kitchen sees order in < 1s
6. Kitchen: preparing → ready → complete
7. Customer tracking page updates each step
8. Invoice email received
9. Inventory deducted
10. Admin dashboard shows revenue
```

**Exit criteria:** Full flow works on staging. No critical bugs.

---

## Step 13: Production Hosting Setup (Week 9–10)

### 13.1 Infrastructure map

```text
┌─────────────────────────────────────────────────────────┐
│  DNS (Cloudflare recommended)                           │
│                                                         │
│  menu.404cafe.in  ──→  Vercel (Next.js frontend)       │
│  api.404cafe.in   ──→  VPS (FastAPI + nginx)            │
└─────────────────────────────────────────────────────────┘

VPS (4 vCPU, 8 GB RAM, Ubuntu 24.04):
  ├── nginx          (TLS termination, reverse proxy)
  ├── fastapi × 4    (gunicorn + uvicorn workers)
  ├── postgres 16
  ├── redis 7
  ├── celery worker
  └── celery beat
```

### 13.2 VPS initial setup

```bash
# SSH into fresh Ubuntu 24.04 VPS
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
sudo usermod -aG docker $USER
```

### 13.3 Clone and configure

```bash
git clone https://github.com/<org>/cafeos.git /opt/cafeos
cd /opt/cafeos/infra
cp .env.production .env
# Fill ALL production secrets
nano .env
```

**Production `.env` essentials:**

```env
DATABASE_URL=postgresql+asyncpg://cafeos:<strong-password>@postgres:5432/cafeos
REDIS_URL=redis://redis:6379/0
JWT_SECRET=<64-char-random>
FRONTEND_URL=https://menu.404cafe.in
ENVIRONMENT=production
```

### 13.4 Production Docker Compose

`infra/docker-compose.prod.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    restart: always
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_USER: cafeos
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: cafeos

  redis:
    image: redis:7-alpine
    restart: always

  backend:
    build: ../backend
    restart: always
    env_file: .env
    depends_on: [postgres, redis]
    command: gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000

  celery:
    build: ../backend
    restart: always
    env_file: .env
    command: celery -A workers.celery_app worker -l info
    depends_on: [redis, postgres]

  celery-beat:
    build: ../backend
    restart: always
    env_file: .env
    command: celery -A workers.celery_app beat -l info
    depends_on: [redis]

volumes:
  pgdata:
```

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
python scripts/seed_menu.py  # first deploy only
```

### 13.5 nginx configuration

`/etc/nginx/sites-available/cafeos`:

```nginx
server {
    listen 80;
    server_name api.404cafe.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.404cafe.in;

    ssl_certificate /etc/letsencrypt/live/api.404cafe.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.404cafe.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/orders {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo certbot --nginx -d api.404cafe.in
sudo nginx -t && sudo systemctl reload nginx
```

### 13.6 Vercel production frontend

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Next.js |
| Production branch | `main` |
| `NEXT_PUBLIC_API_URL` | `https://api.404cafe.in` |
| `NEXT_PUBLIC_WS_URL` | `wss://api.404cafe.in/ws/orders` |

Custom domain: `menu.404cafe.in` → Vercel.

### 13.7 Cloudflare R2 setup

1. Create R2 bucket: `cafeos-prod`
2. Generate API token
3. Set env vars on VPS backend
4. Upload menu images + UPI QR + logo
5. Map public URL or use presigned URLs for invoices

### 13.8 Email setup (Resend example)

1. Verify domain `404cafe.in`
2. Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in backend `.env`
3. Test invoice email delivery

### 13.9 Monitoring

| Tool | Purpose | Cost |
|------|---------|------|
| UptimeRobot | API + frontend uptime | Free |
| Sentry | Error tracking | Free tier |
| Docker logs | `docker compose logs -f backend` | Free |

```bash
# Optional: automate DB backups
0 2 * * * docker exec postgres pg_dump -U cafeos cafeos | gzip > /backups/cafeos_$(date +\%Y\%m\%d).sql.gz
```

**Exit criteria:** Production API live at `api.404cafe.in`. Frontend live at `menu.404cafe.in`. SSL valid. WebSocket works over WSS.

---

## Step 14: Data Migration & Cutover (Week 10)

### 14.1 Pre-cutover checklist

- [ ] Staging flow verified end-to-end
- [ ] Production infra running
- [ ] Menu seeded in production Postgres
- [ ] Admin + staff accounts created
- [ ] Inventory ingredients + recipes entered
- [ ] UPI QR uploaded
- [ ] Fixed expenses entered
- [ ] DNS propagated

### 14.2 Cutover day plan

```text
T-7 days:  Staff training on POS + kitchen dashboards
T-3 days:  Print QR codes linking to menu.404cafe.in
T-1 day:   Final staging test
T-0 hour:  Switch DNS / announce new system
T+0:       Monitor orders closely for 4 hours
T+1 day:   Review first day's P&L in admin
T+7 days:  Decommission old Vercel MERN deploy
```

### 14.3 What to migrate vs. not migrate

| Data | Migrate? | How |
|------|----------|-----|
| Menu items | Yes | `seed_menu.py` from legacy JSON |
| Food images | Yes | Upload to R2 |
| Brand/design | Yes | Tailwind theme (already ported) |
| Old MongoDB orders | No | Historical; not compatible |
| Old JSON orders | No | Start fresh order numbering |
| Inventory | Manual | Admin enters current stock on launch day |
| Fixed expenses | Manual | Admin enters |
| Staff accounts | Manual | Create in new auth system |

### 14.4 Rollback plan

If critical failure on launch day:

1. Revert DNS to old Vercel MERN site (keep it alive for 2 weeks)
2. Fix issue on staging
3. Re-cutover when ready

**Exit criteria:** 404 Café operating on CafeOS in production. First real orders flow through.

---

## Step 15: Legacy Repo Wind-down (Week 10–11)

### 15.1 Freeze the old `Website` repo

```bash
# In Website repo
git checkout -b archive/mern-prototype
# Update README.md with archive notice
git tag v0-mern-final
git push origin archive/mern-prototype --tags
```

### 15.2 Disable old Vercel project

- Keep deployed for 2 weeks as rollback
- Then delete or archive Vercel project

### 15.3 Remove obsolete files (optional, after stable production)

In old repo — do not delete repo, just mark archived:

```text
DEPRECATED — See https://github.com/<org>/cafeos
Prototype preserved for reference in branch archive/mern-prototype
```

### 15.4 Update external links

- Google Maps / Instagram bio → `menu.404cafe.in`
- Table QR codes → new URL
- Any printed materials

**Exit criteria:** Single source of truth is CafeOS. Old system available only as rollback for 2 weeks.

---

## Step 16: Post-Launch Operations (Ongoing)

### 16.1 Daily operations

| Task | Who | When |
|------|-----|------|
| Check pending orders | Staff | During service |
| Review low stock alerts | Admin | End of day |
| Log variable expenses | Admin | End of day |
| Check profit dashboard | Admin | End of day |

### 16.2 Weekly operations

| Task | Detail |
|------|--------|
| DB backup verify | Restore test monthly |
| Review error logs (Sentry) | Fix critical issues |
| Update menu availability | Based on stock |

### 16.3 Monthly operations

| Task | Detail |
|------|--------|
| VPS security updates | `apt upgrade` |
| SSL cert renewal | Auto via certbot |
| Review hosting costs | VPS + R2 + email |
| Dependency updates | `pnpm update`, `pip list --outdated` |

### 16.4 Phase 2 backlog (post-MVP)

- WhatsApp invoice delivery (Gupshup)
- Menu modifier UI (structured customizations)
- Multi-branch `cafe_id` support
- Payment gateway integration
- Customer order history (phone-based lookup)
- Thermal printer integration for kitchen

---

## Master Checklist

### Foundation
- [ ] Pre-flight decisions documented
- [ ] New `cafeos` repo created
- [ ] Legacy menu exported
- [ ] Docker Compose runs locally
- [ ] Backend auth + menu API works
- [ ] Next.js frontend scaffolded on Vercel

### Core product
- [ ] Customer can browse menu
- [ ] Customer can checkout and create order
- [ ] UPI QR payment screen works
- [ ] POS can mark paid / cancel
- [ ] Kitchen dashboard with 3 columns
- [ ] Realtime WebSocket updates
- [ ] Customer order tracking page
- [ ] Invoice PDF generated async
- [ ] Invoice email + download

### Business operations
- [ ] Inventory ingredients seeded
- [ ] Recipes mapped (top items)
- [ ] Stock deducts on payment
- [ ] Low stock alerts
- [ ] Fixed expenses configured
- [ ] Variable expense logging
- [ ] Daily P&L dashboard
- [ ] Nightly financial snapshot job

### Production
- [ ] Staging environment verified
- [ ] VPS provisioned and hardened
- [ ] nginx + SSL configured
- [ ] R2 storage live
- [ ] Email delivery works
- [ ] Monitoring active
- [ ] DB backups automated
- [ ] Production cutover complete
- [ ] Legacy repo archived
- [ ] Staff trained

---

## Quick Reference: Hosting Cost

| Service | Provider | Est. monthly |
|---------|----------|-------------|
| Frontend | Vercel (Hobby/Pro) | ₹0–1,700 |
| Backend VPS | Hetzner CX31 or similar | ₹1,500–3,000 |
| Database | Self-hosted on VPS | ₹0 (included) |
| Redis | Self-hosted on VPS | ₹0 (included) |
| Object storage | Cloudflare R2 | ₹200–500 |
| Domain | Existing | ~₹100 |
| Email | Resend / Brevo | ₹0–500 |
| **Total** | | **₹2,500–5,800** |

---

## Quick Reference: Key Commands

```bash
# Local dev
cd infra && docker compose up -d
cd backend && uvicorn main:app --reload
cd frontend && pnpm dev

# Migrations
cd backend && alembic upgrade head

# Seed menu
python scripts/seed_menu.py

# Production deploy
cd infra && docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Logs
docker compose -f docker-compose.prod.yml logs -f backend celery

# Backup
docker exec postgres pg_dump -U cafeos cafeos > backup.sql
```

---

*Update this document as each step completes. Mark checkboxes and note actual dates in a `docs/PROGRESS.md` log.*
