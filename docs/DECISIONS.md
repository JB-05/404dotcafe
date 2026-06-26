# CafeOS — Pre-flight Decisions

| # | Decision | Choice | Date |
|---|----------|--------|------|
| D-01 | Repository | Evolve `Website` repo into CafeOS monorepo | 2026-06 |
| D-02 | Domains | `menu.404cafe.in` (customer) · `api.404cafe.in` (API) | 2026-06 |
| D-03 | Order token | `404-000123` sequential per day | 2026-06 |
| D-04 | Table number | Optional on order | 2026-06 |
| D-05 | Tax | CGST 2.5% + SGST 2.5% | 2026-06 |
| D-06 | UPI QR | Static QR image + amount as text | 2026-06 |
| D-07 | Invoice MVP | Email + download; WhatsApp Phase 1b | 2026-06 |
| D-08 | Email | Resend (configure in production) | 2026-06 |
| D-09 | VPS | TBD — Hetzner / DigitalOcean | — |
| D-10 | Storage | Cloudflare R2 | 2026-06 |
| D-11 | JWT | HTTP-only secure cookies | 2026-06 |
| D-12 | Legacy code | Keep in repo root until cutover; new code in `frontend/` + `backend/` | 2026-06 |
