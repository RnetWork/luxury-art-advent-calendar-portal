# Advent Collector Portal — Architecture

A private portal for the 100 buyers of a limited 24-print fine-art collection ($4,999). Buying on Shopify grants
one numbered edition, a 24-day digital reveal (Dec 1–24, America/New_York) and one complete set of 24 physical prints.

## 1. System overview

```
                ┌──────────────────────── Shopify ────────────────────────┐
                │ Storefront checkout   Customer Account API   Admin API  │
                └───────┬──────────────────────┬─────────────────┬────────┘
     signed webhooks    │ orders/paid,          │ OAuth 2.0 + PKCE │ GraphQL (server only)
     (HMAC-SHA256)      │ orders/cancelled,     │ (login)          │ re-verify orders
                        │ refunds/create, …     │                  │
┌───────────────────────▼──────────────────────▼─────────────────▼──────────────────┐
│ Next.js app on Vercel (Node runtime)                                               │
│                                                                                    │
│  /api/webhooks/shopify  → verify HMAC → insert webhook_event (unique id) → process │
│  /auth/*                → Shopify OAuth → own session cookie (httpOnly, hashed)    │
│  pages (server components) → requireCollector() / requireAdmin()                   │
│  /api/artworks/:id/image → entitlement + unlock check → stream / signed URL        │
│  /admin/*               → artworks, schedule, editions, fulfillment, events        │
│                                                                                    │
│  adapters/  auth (dev | shopify) · orders (dev | shopify-admin)                    │
│             storage (local | supabase) · fulfillment (manual-export | dev)         │
└───────────────┬───────────────────────────────────────────┬────────────────────────┘
                │ Drizzle over postgres.js                   │ REST (service key, server only)
        ┌───────▼────────┐                          ┌────────▼────────────┐
        │ Supabase        │                          │ Supabase Storage    │
        │ PostgreSQL      │  RLS on, no policies →   │ private bucket      │
        │ (all state)     │  anon key reads nothing  │ "artworks"          │
        └────────────────┘                          └─────────────────────┘
                                         Print lab: CSV export today (manual), API adapter later
```

**Every external service sits behind an adapter with a dev implementation.** With no keys in `.env` the app runs a
full local demo: mock collectors, a mock login, simulated (but really signed and verified) Shopify webhooks, 24
generated artworks on local disk, and a demo clock to time-travel through December.

## 2. Key flows

### Purchase → access
1. Customer buys on Shopify. Shopify sends `orders/create` (often `pending`) then `orders/paid`.
2. `POST /api/webhooks/shopify` reads the raw body, verifies `X-Shopify-Hmac-Sha256` with a constant-time compare,
   then inserts `webhook_event(source, external_id = X-Shopify-Webhook-Id)`. A duplicate id hits the unique
   constraint and returns 200 without processing again (Shopify retries are safe).
3. The processor checks the order contains the collection variant (`SHOPIFY_COLLECTION_VARIANT_IDS`), upserts the
   `collector` and `shop_order`, and — only when `financial_status = paid` and not cancelled — in **one
   transaction**: creates the `entitlement`, claims an edition number, creates the `fulfillment_order`.
4. Optional defence in depth: when `SHOPIFY_ADMIN_ACCESS_TOKEN` is set, the processor re-reads the order from the
   Admin API and uses that status instead of the webhook body.

### Login
- Production: `/auth/login` → Shopify Customer Account API OAuth (authorization code + PKCE, `state`, `nonce`)
  → `/auth/callback` exchanges the code server-side, validates the ID token claims, reads the customer id + email
  → finds the `collector` → creates our own session (random 32-byte token, only its SHA-256 is stored).
- A signed-in customer with no active entitlement sees a polite "no collector edition on this account" page.
  If the Admin API is configured we also look the customer's orders up once (covers a missed webhook).
- Admins sign in the same way; access is granted when the verified email is in `ADMIN_EMAILS`.
- Dev: `/login/dev` lists mock personas (collectors, a refunded buyer, an admin).

### Daily unlock
`unlockAt(day) = December <day>, 00:00:00 America/New_York` of `ADVENT_YEAR`, computed with `Intl` (DST-safe,
tested). All checks run on the server against `now()` (or the dev-only demo clock). Before unlock the server
returns only `{ day, locked: true, unlockAt }` — no title, colour, blur hash or file URL ever reaches the client.

### Artwork files
Stored in a **private** bucket (local: `storage/artworks/`, outside `public/`). The only way to read one is
`GET /api/artworks/:id/image`, which checks session → active entitlement (or admin) → unlocked. Local adapter
streams the file with `Cache-Control: private`; Supabase adapter redirects to a 60-second signed URL.
Object keys contain a random id, so guessing a future key does not help either.

### Editions (atomic, no duplicates)
`edition` holds rows 1..100 (`EDITION_SIZE`). Claiming one:
```sql
UPDATE edition SET status='assigned', entitlement_id=$1, assigned_at=now()
WHERE number = (SELECT number FROM edition WHERE status='available'
                ORDER BY number LIMIT 1 FOR UPDATE SKIP LOCKED)
RETURNING number;
```
plus `UNIQUE(edition.entitlement_id)` and `UNIQUE(entitlement.edition_number)`. Concurrent buyers never get the
same number (covered by a 120-way concurrency test). No row left → entitlement `needs_review` (oversold, refund).
Refunded editions are **retired**, never silently re-issued; an admin can release one back to the pool or assign a
specific number by hand (same constraints apply).

### Fulfillment
- One `fulfillment_order` per entitlement (`UNIQUE(entitlement_id)`) → duplicates are impossible even if the
  webhook is replayed or two admins click at once.
- Statuses: `on_hold → ready → submitted → in_production → shipped → delivered`, plus `cancelled`.
- The print lab has no confirmed API. The `manual-export` adapter produces a CSV (one row per print: 24 rows per
  collector with edition number, SKU, address). Exporting moves rows `ready → submitted` with a conditional
  `UPDATE … WHERE status='ready' RETURNING`, so a row can only ever be exported once. Admin then enters tracking.
- Real lab API later: implement `FulfillmentAdapter.submit()` in `src/adapters/fulfillment/<lab>.ts`.

### Refunds, cancellations, failed payments
| Event | Effect |
|---|---|
| `orders/create` with pending/authorized | `shop_order` stored, entitlement `pending` (no access, no edition) |
| `orders/paid` | entitlement `active`, edition claimed, fulfillment `ready` (or `on_hold` if address missing) |
| payment failed / voided / expired | entitlement stays/becomes `pending` → `revoked` on void; no edition |
| `refunds/create` full refund, `orders/cancelled` | entitlement `revoked`, edition `retired`, fulfillment `cancelled` if not yet submitted; if already submitted → `on_hold` + admin alert (stop at lab) |
| partial refund | logged, access kept, flagged for admin |
| second paid order by same customer | entitlement `needs_review` (one collection per collector) |

## 3. Database schema (PostgreSQL / Supabase)

All ids UUID, all timestamps `timestamptz` (UTC). RLS is enabled on every table with **no policies**: only the
server's direct Postgres connection can read/write; the Supabase anon key can read nothing.

| Table | Purpose / key columns | Constraints |
|---|---|---|
| `collector` | person: `shopify_customer_id`, `email`, `first_name`, `last_name` | unique `shopify_customer_id`, unique lower(`email`) |
| `session` | `token_hash`, `collector_id` or `admin_email`, `expires_at` | unique `token_hash` |
| `shop_order` | Shopify order: `shopify_order_id`, `name` (#1001), `financial_status`, `cancelled_at`, `total_cents`, `currency`, `quantity`, shipping address (json) | unique `shopify_order_id` |
| `entitlement` | access + edition: `collector_id`, `order_id`, `status` (pending/active/revoked/needs_review), `edition_number`, `revoked_reason` | unique `order_id`, unique `edition_number`, partial unique (`collector_id`) where active |
| `edition` | numbers 1..N: `number`, `status` (available/assigned/retired), `entitlement_id` | pk `number`, unique `entitlement_id`, check 1..N |
| `artwork` | `day` 1..24, `title`, `artist`, `medium`, `dimensions`, `year`, `description`, `story`, `image_key`, `width`, `height`, `accent`, `print_sku`, `published` | unique `day`, check 1..24 |
| `reveal_view` | which doors a collector opened: (`collector_id`, `artwork_id`), `first_viewed_at` | pk pair |
| `fulfillment_order` | `entitlement_id`, `status`, ship-to fields, `carrier`, `tracking_number`, `tracking_url`, `export_batch_id`, `lab_reference`, timestamps | **unique `entitlement_id`** |
| `fulfillment_event` | history: `fulfillment_order_id`, `status`, `note`, `actor` | |
| `export_batch` | CSV export: `created_by`, `order_count`, `csv` | |
| `webhook_event` | `source`, `external_id`, `topic`, `status` (received/processed/ignored/failed), `error`, `payload` | **unique (`source`,`external_id`)** |
| `audit_log` | admin + security events: `actor`, `action`, `target`, `meta` | |

Drizzle schema: `src/db/schema.ts`. Migrations: `drizzle/`.

## 4. Folder map

```
advent-portal/
  src/app/
    page.tsx                    welcome + login
    login/dev/                  mock personas (dev only)
    auth/login|callback|logout  Shopify Customer Account OAuth + session
    (portal)/calendar           24 doors
    (portal)/reveal/[day]       cinematic reveal
    (portal)/collection         personal gallery
    (portal)/certificate        numbered certificate (printable)
    (portal)/shipping           print order + tracking
    admin/                      overview, artworks, editions, fulfillment, events, dev tools
    api/webhooks/shopify        verified, idempotent webhook endpoint
    api/artworks/[id]/image     guarded image delivery
    api/admin/export            fulfillment CSV
  src/lib/        brand, unlock (time zone), tracking urls, csv, crypto, env
  src/server/     auth/session, access, editions, orders (webhook processing), fulfillment, artworks, audit
  src/adapters/   auth, orders, storage, fulfillment — each {index,dev,<provider>}.ts
  src/db/         schema, client, seed, generated demo art
  tests/unit      Vitest (needs Postgres)
  tests/e2e       Playwright
```
