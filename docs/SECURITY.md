# Security checklist

Tick every box before Dec 1. Items marked ✅ are implemented in code and covered by tests; ☐ are launch tasks.

## Access control
- ✅ Every portal page calls `requireCollector()`: signed-in **and** an `active` entitlement (paid, not refunded/cancelled). Checked per request, so a refund closes the portal on the next click.
- ✅ Admin = verified Shopify email listed in `ADMIN_EMAILS`, re-checked on every request (removing an email revokes admin immediately).
- ✅ Collectors are redirected away from `/admin`; every admin server action re-checks admin itself (never relies on hidden buttons).
- ✅ Sessions: 32-byte random token in an `httpOnly`, `Secure` (on https), `SameSite=Lax` cookie; only its SHA-256 is stored. Logout deletes the row.
- ✅ Logout is POST-only; server actions get Next.js' built-in Origin check (CSRF).
- ☐ Set `DEMO_MODE=false` (it is also forced off whenever `VERCEL_ENV=production`).

## Future artwork never leaks
- ✅ Locked doors are sent to the browser as `{ day, state, unlockAt }` only — no id, title, colour, thumbnail or URL (`tests/unit/access.test.ts`).
- ✅ Files live in a **private** bucket (local: `storage/`, outside `public/`). The only door to them is `/api/artworks/:id/image`, which checks session → entitlement → `published` → unlock time, and answers 404 for "not yet" (no oracle).
- ✅ Supabase files are served through a 60-second signed URL generated only after the check; storage keys are random UUIDs.
- ✅ Image responses are `Cache-Control: private` (never cached by a CDN); refusals are `no-store`.
- ✅ Unlock time is computed on the server from `ADVENT_YEAR` + America/New_York (DST-safe). The client clock is never trusted. The demo clock is a signed cookie honoured only in demo mode.
- ✅ The shipping page lists titles only for revealed days.
- ☐ Upload all 24 artworks as **unpublished drafts** first; publish them in the admin after review.

## Shopify
- ✅ All Shopify credentials are server-only env vars (no `NEXT_PUBLIC_`), read through `src/lib/env.ts` which imports `server-only`.
- ✅ Webhooks: raw-body HMAC-SHA256, constant-time compare, optional shop-domain check; 401 on mismatch before any DB write.
- ✅ Idempotency: `webhook_event (source, external_id)` unique; replays return 200 `duplicate`. Processing itself is idempotent (row lock per order, unique `order_id`, unique fulfillment per entitlement, refunds counted by refund id).
- ✅ Out-of-order events cannot downgrade a paid order or re-grant access after a refund/cancel.
- ✅ With `SHOPIFY_ADMIN_ACCESS_TOKEN` set, every event is re-read from the Admin API (the webhook only says "something changed").
- ✅ Customer login: OAuth 2.0 code flow + PKCE (S256), `state` + `nonce` in a signed, 10-minute, path-scoped cookie; ID-token `iss`/`aud`/`exp`/`nonce` validated.
- ☐ Admin API token scopes limited to `read_orders`, `read_customers`.
- ☐ Product limited to quantity 1 per order; inventory 100.

## Data
- ✅ Supabase RLS enabled on every table with no policies → the public anon key can read nothing (`drizzle/0001_rls.sql`).
- ✅ Webhook log stores a redacted payload (no address/phone).
- ✅ CSV export neutralises spreadsheet formulas (`=`, `+`, `-`, `@`).
- ✅ SVG/HTML uploads are served with `Content-Security-Policy: sandbox` and `nosniff`.
- ☐ Never expose the Supabase service-role key to the browser; rotate it if it ever leaks.
- ☐ Enable Supabase point-in-time recovery (or daily backups) before launch.

## Platform
- ✅ Security headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` off; `robots: noindex`.
- ☐ Vercel Firewall: rate-limit `/auth/*` and `/api/webhooks/*` (e.g. 60/min/IP).
- ☐ Vercel Deployment Protection on preview deployments.
- ☐ Alerts: watch for `failed` rows in Admin → Shopify events.
- ☐ Rehearse Dec 1 on staging with the demo clock, then turn demo mode off.
