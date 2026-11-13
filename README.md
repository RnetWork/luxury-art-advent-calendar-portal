# The Twenty-Four — collector portal

Private, luxury digital advent calendar for a limited fine-art collection: 100 numbered collector editions sold on
Shopify at $4,999, each unlocking one artwork a day (Dec 1–24, New York time) and including all 24 physical prints.

- **Architecture, schema, flows:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Phases:** [docs/PLAN.md](docs/PLAN.md) · **Decisions:** [docs/DECISIONS.md](docs/DECISIONS.md)
- **Security checklist:** [docs/SECURITY.md](docs/SECURITY.md) · **Deployment:** [docs/DEPLOY.md](docs/DEPLOY.md)

Stack: Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · Motion (Framer Motion) · Postgres/Supabase via
Drizzle · Shopify Customer Account API (login) + Admin API & signed webhooks (purchases) · Vercel.

## Run the local demo (no API keys)

Needs Docker Postgres on port 5433 (the CRM's `pnpm services:up` starts it) and Node 22+.

```bash
pnpm install
pnpm run setup      # .env, database "advent", migrations, demo seed
pnpm dev            # http://localhost:3100
```

Walkthrough:
1. Open http://localhost:3100 → **Demo personas** → *Eleanor Whitfield* (edition No. 1).
2. Before December you see a countdown. Click **Demo clock** (bottom right) → *Dec 12*: twelve doors open.
3. Open today's door for the cinematic reveal; browse **Collection**, **Certificate** (printable), **Prints** (shipping status).
4. Try *Margaret Chen* (refunded → no access) and *Daniel Reyes* (payment pending).
5. Sign in as *The Curator* → Admin: artworks & schedule, editions, fulfillment (CSV export, tracking), Shopify events,
   and **Demo tools**, which send real HMAC-signed webhooks (purchase, refund, cancel, failed payment, replay, forged).

`pnpm db:reset` wipes and re-seeds the local database.

## Commands

| Command | |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js on port 3100 |
| `pnpm typecheck` · `pnpm lint` | TypeScript, ESLint |
| `pnpm test` | Vitest: unlock clock, HMAC, order lifecycle, refunds, 120 concurrent buyers → 100 unique editions, export-once, access to future art (uses database `advent_test`) |
| `pnpm e2e` | Playwright (desktop + iPhone) against the demo |
| `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` | Drizzle |

## Environment variables

All server-side; see [.env.example](.env.example). Missing Shopify/Supabase keys fall back to the dev adapters.

| Variable | Purpose |
|---|---|
| `APP_URL` | Public URL (OAuth callback, cookies) |
| `SESSION_SECRET` | 32+ random bytes; signs the OAuth state and demo-clock cookies |
| `DEMO_MODE` | `true` locally only; forced off when `VERCEL_ENV=production` |
| `ADVENT_YEAR`, `EDITION_SIZE` | Release year (unlocks Dec 1–24 of it) and number of editions (100) |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Supabase pooled (runtime) and direct (migrations) Postgres URLs |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Private artwork storage (empty = local `./storage`) |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_API_VERSION` | Store and API version |
| `SHOPIFY_SHOP_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` | Customer login |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Re-verifies every order with the Admin API |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook HMAC key |
| `SHOPIFY_COLLECTION_VARIANT_IDS` | Variant id(s) of the collection product |
| `FULFILLMENT_PROVIDER`, `PRINT_LAB_NAME`, `PRINT_SKU_PREFIX` | Print lab adapter (`manual` = CSV export) |

## Where things live

`src/server/orders.ts` webhook intake and order → entitlement rules · `src/server/editions.ts` atomic edition numbers ·
`src/server/fulfillment.ts` print orders and export · `src/server/artworks.ts` unlock gate · `src/lib/unlock.ts`
New York clock · `src/adapters/*` Shopify, storage, fulfillment · `src/app/(portal)` collector pages · `src/app/admin`.
The house and collection names live only in `src/lib/brand.ts`.
