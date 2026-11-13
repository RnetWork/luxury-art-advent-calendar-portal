# Implementation plan

| Phase | Scope | Status |
|---|---|---|
| **0 — Design** | Architecture, schema, env list, security checklist (this folder) | done |
| **1 — Local demo** | Next.js app, Postgres schema + migrations, mock personas, simulated signed Shopify webhooks, atomic editions, unlock clock (+ dev demo clock), 24 generated artworks, all 7 pages, admin, CSV export, unit + e2e tests | done |
| **2 — Shopify live** | Create Shopify custom app (Admin API scopes `read_orders`, `read_customers`), Customer Account API client, register webhooks (`orders/create`, `orders/paid`, `orders/cancelled`, `orders/updated`, `refunds/create`), set `SHOPIFY_COLLECTION_VARIANT_IDS`, test with a Shopify development store + Bogus Gateway | code ready, needs credentials |
| **3 — Supabase + Vercel** | Supabase project (US East), run migrations, private bucket `artworks`, Vercel env vars, custom domain, upload real artwork | code ready, needs accounts |
| **4 — Print lab** | Confirm lab, agree CSV columns / SKUs / file delivery. If they have an API, add `src/adapters/fulfillment/<lab>.ts` | manual export ready |
| **5 — Launch hardening** | Pen-test style review, load test (100 users is small), rehearse Dec 1 unlock with the demo clock on staging, set `ALLOW_DEMO_CLOCK=false` | before Dec 1 |

Optional later: email notifications for each daily unlock (Resend), push tracking back to Shopify as a fulfillment,
high-resolution download per artwork, German/other locales.
