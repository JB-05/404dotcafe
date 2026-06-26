# CafeOS Phase 1 MVP — Product & Engineering Analysis

**Document type:** Engineering companion to the Master PRD  
**Product:** CafeOS (initial tenant: 404 Café)  
**Version:** 1.0  
**Date:** June 2026  
**Status:** Planning / Pre-implementation

---

## 1. Executive Summary

CafeOS is a **full-stack, real-time café operating system** designed to replace fragmented tools (paper pads, WhatsApp orders, manual stock sheets, spreadsheet finance) with a single platform covering the entire order-to-profit lifecycle.

Phase 1 targets **one café (404 Café)** with ten integrated modules: customer ordering, payments, POS, kitchen, tracking, invoices, admin, inventory, financial analytics, and role-based auth.

The spec defines a **production-grade architecture** (Next.js + FastAPI + PostgreSQL + Redis + Celery + WebSockets) with explicit engineering constraints around transactional integrity, server-side validation, and zero order loss during rush hour.

### Current codebase reality

The existing **404 Café Website** repository is an early prototype:

| Area | Current state |
|------|---------------|
| Frontend | React 19 + Vite (single `App.jsx`, ~770 lines) |
| Backend | Express + Mongoose (MongoDB with JSON fallback) |
| Auth | None |
| Realtime | None |
| Payment | None (mock receipt only) |
| Kitchen UI | None (`GET /api/orders` exists, unused) |
| Inventory / Finance | None |
| Deploy | Vercel (frontend only); backend not wired |

**Conclusion:** The PRD describes a **greenfield rebuild**, not an incremental upgrade. The current repo can inform menu content, visual branding, and UX patterns, but should not be extended as the CafeOS foundation.

---

## 2. PRD Analysis

### 2.1 Product vision clarity

The PRD is well-scoped for an MVP:

- **In scope:** Single-branch café operations end-to-end
- **Out of scope:** Multi-branch, vendors, payroll, AI, franchise SaaS

The seven order states (`CART` → `COMPLETED` / `CANCELLED`) form a clear state machine. The payment model (static UPI QR + manual staff verification) is pragmatic for India and avoids payment-gateway complexity in Phase 1.

### 2.2 Strengths of the specification

| Strength | Why it matters |
|----------|----------------|
| Explicit order state machine | Prevents ambiguous workflows between POS and kitchen |
| Server-side pricing rule | Critical for trust and fraud prevention |
| Stock deduction tied to `PAID` | Avoids inventory drift from abandoned carts |
| Async invoice generation | Keeps order API fast under load |
| Financial model beyond revenue | COGS + fixed/variable expenses enable real profit visibility |
| Engineering constraints section | Gives non-negotiable rules for implementation |
| Completion criteria checklist | Clear definition of "done" |

### 2.3 Gaps and ambiguities to resolve before build

| # | Gap | Recommendation |
|---|-----|----------------|
| 1 | **Table vs token ordering** — Current 404 app uses table numbers; PRD uses order tokens (`404-000123`) and customer name at checkout | Decide: keep table number as optional field, or drop it for MVP |
| 2 | **Tax model** — Current app splits CGST/SGST (2.5% each); PRD uses single `tax` field | Confirm GST breakdown required on invoice (likely yes for India) |
| 3 | **Menu customizations** — Current app has add-ons per item; PRD mentions item notes but not structured modifiers | Add `order_item_modifiers` or treat as free-text notes for MVP |
| 4 | **UPI QR source** — Static QR image vs dynamically generated with amount | PRD says static; document which UPI ID and whether amount is shown separately |
| 5 | **WhatsApp delivery** — No provider specified (Twilio, Gupshup, manual) | MVP: download link + email first; WhatsApp as Phase 1b if API keys ready |
| 6 | **Multi-device POS** — No conflict resolution if two staff mark same order paid | Add optimistic locking (`version` column) or status transition guards |
| 7 | **WebSocket auth** — PRD protects HTTP routes but not WS subscription scope | Kitchen/POS sockets must be tenant-scoped and role-filtered |
| 8 | **Idempotency** — Mentioned but not specified | Use `Idempotency-Key` header on `POST /orders` with 24h Redis TTL |
| 9 | **PWA offline** — Listed in stack but no offline behavior defined | MVP: installable shell + cached menu; cart syncs when online |
| 10 | **SaaS tenancy** — Single café now, but schema has no `cafe_id` | Add nullable `cafe_id` on core tables now to avoid painful migration later |

### 2.4 Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Stack change (MERN → Next + FastAPI) | High | Treat as new repo; migrate menu seed data only |
| VPS ops burden (Postgres, Redis, Celery) | Medium | Docker Compose from day one; documented runbooks |
| Manual payment verification errors | Medium | POS shows expected amount prominently; confirm dialog |
| Rush-hour WebSocket fan-out | Medium | Redis Pub/Sub + connection pooling; load test early |
| Inventory recipe accuracy | Medium | Start with top 5 items; expand iteratively |
| Financial snapshot accuracy | Low–Med | Nightly Celery job + manual reconciliation UI |

---

## 3. Target Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                        │
│  Next.js 15 · TypeScript · Tailwind · shadcn/ui · PWA      │
│                                                             │
│  /menu  /checkout  /order/{id}  /pos  /kitchen  /admin     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + WSS
              ┌────────────▼────────────┐
              │   FastAPI Backend VPS   │
              │   nginx · gunicorn      │
              └────────────┬────────────┘
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
    │ Postgres│      │   Redis   │    │  Celery   │
    │   16    │      │ Pub/Sub   │    │  Workers  │
    └─────────┘      └───────────┘    └───────────┘
                                              │
                                        ┌─────▼─────┐
                                        │ R2 / S3   │
                                        │ invoices  │
                                        │ assets    │
                                        └───────────┘
```

### Layered backend design (per PRD §22)

```text
API Routes (thin)
    ↓
Services (business logic, state transitions, transactions)
    ↓
Repositories (SQLAlchemy queries)
    ↓
PostgreSQL
```

**Rule:** Order state transitions, pricing, stock deduction, and payment confirmation live exclusively in the **service layer**, never in route handlers or frontend.

---

## 4. Module Breakdown

### 4.1 Customer Ordering App (`/menu`, `/checkout`)

| Feature | PRD requirement | Implementation notes |
|---------|-----------------|----------------------|
| Category menu | Burgers, Drinks, Desserts, Add-ons | Seed from existing `data/menu.json` |
| Item detail | Image, description, price, availability | `available` flag from DB; hide or grey out unavailable |
| Cart | Frontend Zustand store | Persist to `sessionStorage` for refresh survival |
| Checkout | Name required; phone/email optional | `POST /api/v1/orders` creates `PENDING_PAYMENT` order |
| Pricing | Backend recalculates | Never send `total` as source of truth from client |

### 4.2 Payment Workflow

```text
Order created (PENDING_PAYMENT)
    → Display static UPI QR + token + amount
    → Customer pays externally
    → Staff verifies on POS
    → PATCH /pos/orders/{id}/payment → PAID
    → WebSocket: ORDER_PAID
    → Celery: generate invoice
    → Stock deduction triggered
```

### 4.3 POS Dashboard (`/pos`)

- **Audience:** STAFF role
- **Primary view:** Active orders sorted unpaid-first, oldest-first
- **Actions:** Mark paid, cancel
- **Realtime:** Subscribe to `ORDER_CREATED`, `ORDER_PAID`, `ORDER_CANCELLED`

### 4.4 Kitchen Dashboard (`/kitchen`)

- **Audience:** KITCHEN role
- **Layout:** Three columns — Paid | Preparing | Ready
- **Actions:** Start preparation (`IN_PREPARATION`), mark ready (`READY`), complete (`COMPLETED`)
- **Urgency:** Elapsed time badges (0–5 normal, 5–10 warning, 10+ critical)

### 4.5 Order Tracking (`/order/{order_id}`)

- Public route (no auth)
- Poll or WebSocket for status updates
- Progress: Pending Payment → Paid → Preparing → Ready → Completed

### 4.6 Invoice System

- Trigger: payment confirmed (`PAID` transition)
- Worker: Celery task generates PDF → uploads to R2 → stores `pdf_url`
- Delivery: email (required path), WhatsApp (optional), download link
- **Never block** the payment confirmation API

### 4.7 Admin Dashboard (`/admin`)

| Section | Key metrics / actions |
|---------|----------------------|
| Overview | Revenue today, orders today, AOV, pending/completed counts |
| Orders | Full order history with filters |
| Inventory | Ingredient master, recipes, alerts, adjustments |
| Sales | Hourly sales chart, order volume |
| Finance | Revenue, COGS, expenses, net profit, margin |
| Staff | User management (ADMIN only) |

### 4.8 Inventory Management

**Deduction trigger:** `PENDING_PAYMENT → PAID` only.

```text
For each order_item:
    lookup menu_item_recipes
    for each ingredient:
        current_stock -= quantity_required * order_qty
        insert stock_movement (reason: ORDER_FULFILLMENT)
    if current_stock <= threshold → alert
```

### 4.9 Financial Analytics

| Metric | Formula |
|--------|---------|
| Revenue | Sum of `COMPLETED` order totals for period |
| COGS | Sum of ingredient costs consumed (from recipes × orders) |
| Fixed expense (daily) | Monthly amount ÷ days in month |
| Variable expense | Sum of logged variable expenses for day |
| Gross profit | Revenue − COGS |
| Net profit | Revenue − (COGS + fixed + variable) |
| Profit margin | (Net profit / Revenue) × 100 |

Nightly Celery job writes `daily_financial_snapshots`.

### 4.10 Authentication & Roles

| Role | Routes | Permissions |
|------|--------|-------------|
| (none) | `/menu`, `/checkout`, `/order/{id}` | Public |
| STAFF | `/pos` | Verify payment, cancel orders |
| KITCHEN | `/kitchen` | Update preparation status |
| ADMIN | `/admin` | Full access |

JWT access + refresh tokens. HTTP-only cookies or Bearer header (decide in implementation).

---

## 5. Order State Machine

```text
                    ┌─────────────┐
                    │    CART     │  (frontend only)
                    └──────┬──────┘
                           │ checkout
                    ┌──────▼──────────────┐
                    │  PENDING_PAYMENT    │
                    └──────┬──────────────┘
              cancel │    │ staff confirms payment
         ┌───────────┘    └───────────┐
         │                            │
  ┌──────▼──────┐              ┌─────▼─────────────┐
  │  CANCELLED  │              │       PAID        │
  └─────────────┘              └─────┬─────────────┘
                                     │ kitchen starts
                              ┌──────▼─────────────┐
                              │  IN_PREPARATION    │
                              └──────┬─────────────┘
                                     │ mark ready
                              ┌──────▼─────────────┐
                              │       READY        │
                              └──────┬─────────────┘
                                     │ complete
                              ┌──────▼─────────────┐
                              │     COMPLETED      │
                              └────────────────────┘
```

### Valid transitions (server-enforced)

| From | To | Actor | Side effects |
|------|----|-------|--------------|
| — | PENDING_PAYMENT | Customer | Create order + items; emit `ORDER_CREATED` |
| PENDING_PAYMENT | PAID | Staff | Create payment record; deduct stock; emit `ORDER_PAID`; queue invoice |
| PENDING_PAYMENT | CANCELLED | Staff | Emit `ORDER_CANCELLED` |
| PAID | IN_PREPARATION | Kitchen | Emit `ORDER_STARTED` |
| IN_PREPARATION | READY | Kitchen | Emit `ORDER_READY` |
| READY | COMPLETED | Kitchen/Staff | Emit `ORDER_COMPLETED`; include in revenue |
| PAID | CANCELLED | Admin only | Reverse stock (if deducted); audit log |

Invalid transitions return `409 Conflict` with current state.

---

## 6. Database Schema Notes

The PRD schema (§19) is a solid MVP foundation. Recommended additions:

| Table | Additional columns | Reason |
|-------|-------------------|--------|
| `orders` | `idempotency_key`, `version`, `table_number` (nullable) | Duplicate prevention; optimistic locking; 404 Café table flow |
| `orders` | `cgst`, `sgst` (or `tax_breakdown` JSONB) | Indian GST invoice compliance |
| `menu_items` | `cafe_id` (nullable, default 1) | Future SaaS |
| `order_items` | `modifiers` JSONB | Structured customizations |
| `users` | `is_active`, `last_login_at` | Staff management |
| `payments` | `verified_by_user_id`, `verification_notes` | Audit trail for manual UPI |
| `stock_movements` | `reference_order_id`, `created_by_user_id` | Traceability |

### Index strategy

```sql
-- High-traffic queries
CREATE INDEX idx_orders_status_created ON orders (order_status, created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders (payment_status, created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_stock_movements_item_date ON stock_movements (inventory_item_id, created_at DESC);
CREATE INDEX idx_daily_snapshots_date ON daily_financial_snapshots (date DESC);
```

---

## 7. API Surface Summary

**Base:** `/api/v1`

### Public

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/menu` | Categories + items + availability |
| POST | `/orders` | Create order (→ PENDING_PAYMENT) |
| GET | `/orders/{id}` | Order status for tracking |

### Authenticated

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | — | Issue JWT |
| POST | `/auth/refresh` | — | Refresh token |
| GET | `/pos/orders` | STAFF+ | Active orders |
| PATCH | `/pos/orders/{id}/payment` | STAFF+ | Confirm payment |
| PATCH | `/pos/orders/{id}/cancel` | STAFF+ | Cancel order |
| GET | `/kitchen/orders` | KITCHEN+ | Orders by kitchen column |
| PATCH | `/kitchen/orders/{id}/status` | KITCHEN+ | Advance preparation |
| GET | `/inventory/items` | ADMIN | List ingredients |
| POST | `/inventory/adjust` | ADMIN | Manual stock change |
| GET | `/inventory/alerts` | ADMIN | Low stock list |
| GET | `/finance/summary` | ADMIN | Today's P&L |
| POST | `/finance/variable-expenses` | ADMIN | Log expense |

### WebSocket

**Endpoint:** `/ws/orders`

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `ORDER_CREATED` | order summary | POS |
| `ORDER_PAID` | order id, token | Kitchen, POS |
| `ORDER_STARTED` | order id | POS, tracking |
| `ORDER_READY` | order id | POS, tracking |
| `ORDER_COMPLETED` | order id | Admin, tracking |
| `ORDER_CANCELLED` | order id | All dashboards |

---

## 8. Realtime Architecture

```text
Service层 status change
    → publish to Redis channel "orders:{cafe_id}"
    → WebSocket manager subscribes
    → broadcast to connected clients filtered by role
```

**Client requirements (PRD §21, §26):**

- Auto-reconnect with exponential backoff
- On reconnect: fetch missed orders via REST snapshot
- TanStack Query invalidation on WS events

---

## 9. Current Codebase → CafeOS Mapping

What can be **reused** from the existing 404 Café repo:

| Asset | Reuse strategy |
|-------|----------------|
| Menu item data (`seed.js`, `data/menu.json`) | Migrate to Postgres seed script |
| Visual design tokens (colors, fonts) | Port to Tailwind theme config |
| UX patterns (waiter pad, receipt modal, category nav) | Inform Next.js component design |
| Food illustrations | Upload to R2; reference via `image_url` |
| Brand copy (taglines, location) | Use in checkout + invoice templates |

What must be **replaced**:

| Current | CafeOS target |
|---------|---------------|
| React + Vite | Next.js 15 + TypeScript |
| Express + Mongoose | FastAPI + SQLAlchemy |
| MongoDB / JSON files | PostgreSQL 16 |
| No auth | JWT + roles |
| 3 order statuses | 7-state machine |
| Client-side pricing | Server-side pricing |
| No WebSockets | Redis Pub/Sub + WS |
| Vercel frontend-only | Vercel frontend + VPS backend |

---

## 10. Recommended Implementation Phases

### Phase 0 — Foundation (Week 1–2)

- [ ] New monorepo: `frontend/` (Next.js) + `backend/` (FastAPI)
- [ ] Docker Compose: Postgres, Redis, backend, Celery worker
- [ ] Alembic migrations for core tables
- [ ] Auth (login, JWT, role middleware)
- [ ] Menu CRUD + public `GET /menu`
- [ ] Seed 404 Café menu from existing data

### Phase 1 — Order Core (Week 3–4)

- [ ] Customer `/menu` + cart (Zustand)
- [ ] `/checkout` + `POST /orders` with server pricing
- [ ] Order state machine service
- [ ] Static UPI QR payment screen
- [ ] `/order/{id}` tracking page
- [ ] Idempotency on order creation

### Phase 2 — Staff Dashboards (Week 5–6)

- [ ] POS dashboard + payment verification
- [ ] Kitchen dashboard + column layout
- [ ] WebSocket realtime layer
- [ ] Urgency indicators
- [ ] Auto-reconnect client

### Phase 3 — Invoice & Notifications (Week 7)

- [ ] Celery invoice PDF generation
- [ ] R2 upload
- [ ] Email delivery
- [ ] Download link on order tracking page

### Phase 4 — Inventory (Week 8)

- [ ] Ingredient master
- [ ] Recipe mapping (top items first)
- [ ] Stock deduction on PAID
- [ ] Low stock alerts
- [ ] Manual adjustment + audit log

### Phase 5 — Admin & Finance (Week 9–10)

- [ ] Admin overview dashboard
- [ ] Fixed + variable expense entry
- [ ] COGS calculation
- [ ] Daily financial snapshots (Celery)
- [ ] Profit charts
- [ ] Break-even indicator

### Phase 6 — Hardening (Week 11–12)

- [ ] Load testing (concurrent orders)
- [ ] Transaction rollback tests
- [ ] PWA manifest + service worker
- [ ] Production VPS deploy + nginx
- [ ] Monitoring + error alerting
- [ ] MVP completion criteria verification

---

## 11. Engineering Constraints Checklist

From PRD §26 — these are **non-negotiable** during implementation:

| # | Constraint | Verification |
|---|------------|--------------|
| 1 | Never trust frontend pricing | Unit test: tampered cart total rejected |
| 2 | All order transitions validated backend | State machine tests for every edge |
| 3 | DB transactions for money flows | Payment + stock in single transaction |
| 4 | Every stock change logged | `stock_movements` row for every delta |
| 5 | Invoices generated async | Payment API returns < 200ms; invoice queued |
| 6 | WebSocket reconnect required | Client reconnect test |
| 7 | No order loss during rush hour | Load test: 50 concurrent checkouts |
| 8 | Critical operations atomic | Rollback test on partial failure |

---

## 12. MVP Completion Criteria Tracker

From PRD §27:

| Criterion | Status | Notes |
|-----------|--------|-------|
| Customer can browse menu | ⬜ Not started | `/menu` |
| Customer can place order | ⬜ Not started | `/checkout` |
| QR payment works | ⬜ Not started | Static UPI display |
| Staff verifies payment | ⬜ Not started | POS mark paid |
| Kitchen receives realtime orders | ⬜ Not started | WS + `/kitchen` |
| Kitchen updates status | ⬜ Not started | Column actions |
| Customer tracks order | ⬜ Not started | `/order/{id}` |
| Invoice generated and delivered | ⬜ Not started | Celery + email |
| Inventory auto deducts stock | ⬜ Not started | On PAID transition |
| Low stock alerts work | ⬜ Not started | Threshold check |
| Daily expenses tracked | ⬜ Not started | Admin finance |
| Profit analytics visible | ⬜ Not started | Dashboard charts |
| Admin dashboard operational | ⬜ Not started | `/admin` |

---

## 13. Infrastructure & Cost Summary

**Target VPS:** 4 vCPU · 8 GB RAM · 100 GB SSD · Ubuntu 24.04

**Docker Compose services:**

| Service | Image / runtime |
|---------|-----------------|
| `frontend` | Deployed to Vercel (not in Compose) |
| `backend` | FastAPI + Gunicorn + Uvicorn workers |
| `postgres` | PostgreSQL 16 |
| `redis` | Redis 7 |
| `celery` | Celery worker + beat |
| `nginx` | Reverse proxy + TLS |

**Estimated monthly cost:** ₹2,500–7,000 (per PRD §25)

---

## 14. Suggested Repository Structure

```text
cafeos/
├── frontend/                    # Next.js 15
│   ├── app/
│   │   ├── menu/
│   │   ├── checkout/
│   │   ├── order/[id]/
│   │   ├── pos/
│   │   ├── kitchen/
│   │   └── admin/
│   ├── components/
│   ├── lib/
│   ├── stores/
│   └── hooks/
├── backend/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── menu.py
│   │   │   ├── orders.py
│   │   │   ├── pos.py
│   │   │   ├── kitchen.py
│   │   │   ├── inventory.py
│   │   │   └── finance.py
│   │   └── websocket.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   │   ├── order_service.py
│   │   ├── payment_service.py
│   │   ├── inventory_service.py
│   │   └── finance_service.py
│   ├── repositories/
│   ├── workers/
│   │   ├── invoice_tasks.py
│   │   └── analytics_tasks.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── redis.py
│   └── alembic/
├── docker-compose.yml
├── docker-compose.prod.yml
├── docs/
│   └── CAFEOS_MVP_ANALYSIS.md    # this document
└── scripts/
    └── seed_404_cafe.py
```

---

## 15. Open Decisions Log

| ID | Decision | Options | Status |
|----|----------|---------|--------|
| D-01 | Repository strategy | New repo vs evolve current Website repo | **Recommend: new repo** |
| D-02 | Table number field | Keep / drop / optional | Pending |
| D-03 | GST line items on invoice | CGST+SGST split vs single tax | Pending |
| D-04 | WhatsApp provider | Gupshup / Twilio / defer | Pending |
| D-05 | JWT storage | HTTP-only cookie vs localStorage | Pending |
| D-06 | `cafe_id` multi-tenancy | Add now vs later | **Recommend: add now** |
| D-07 | Menu modifiers | JSONB notes vs modifier table | Pending |

---

## 16. Conclusion

The CafeOS Phase 1 PRD is **implementation-ready** with clear modules, a sound data model, and explicit engineering guardrails. The primary gap is not product definition — it is **execution planning** against a codebase that shares only branding and menu content with the target system.

**Recommended next steps:**

1. Confirm open decisions (§15), especially repo strategy and tax model
2. Stand up Phase 0 foundation (monorepo + Docker + auth + menu seed)
3. Archive or freeze the current MERN prototype as a design reference
4. Begin Phase 1 order core as the first vertical slice

---

*This document should be updated as decisions are made and phases complete.*
