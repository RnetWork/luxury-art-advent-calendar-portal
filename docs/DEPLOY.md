# Deployment (Supabase + Vercel + Shopify)

## 1. Supabase
1. Create a project in a **US East** region (close to Vercel `iad1` and New York unlock traffic).
2. Settings → Database → copy two connection strings:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`
   - **Direct connection** (port 5432) → `DATABASE_URL_UNPOOLED` (migrations only)
3. Storage → New bucket `artworks`, **Public: off**.
4. Settings → API → copy the project URL → `SUPABASE_URL`, and the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only).
5. Run migrations from your machine once (later deploys run them in the build):
   ```bash
   DATABASE_URL_UNPOOLED="postgres://…:5432/postgres" pnpm exec tsx src/db/migrate.ts
   ```
   Do **not** run `db:seed` in production. Create the edition pool with:
   ```sql
   insert into edition (number) select g from generate_series(1, 100) g on conflict do nothing;
   ```

## 2. Shopify
1. **Product**: one product, one variant, $4,999, inventory 100, "limit 1 per order" (Shopify's purchase limits or a checkout rule). Copy the variant id → `SHOPIFY_COLLECTION_VARIANT_IDS`.
2. **Custom app** (Settings → Apps and sales channels → Develop apps):
   - Admin API scopes: `read_orders`, `read_customers`. Install → Admin API access token → `SHOPIFY_ADMIN_ACCESS_TOKEN`.
   - API secret key → `SHOPIFY_WEBHOOK_SECRET`.
   - `SHOPIFY_STORE_DOMAIN` = `your-store.myshopify.com`.
3. **Webhooks** (register through the app so they're signed with its secret), format JSON, URL `https://<portal-domain>/api/webhooks/shopify`:
   `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `refunds/create`.
   If you create them under Settings → Notifications → Webhooks instead, use the signing key shown there as `SHOPIFY_WEBHOOK_SECRET`.
4. **Customer Account API** (requires the new customer accounts): install the Headless (or Hydrogen) channel → Customer Account API → set client type **Confidential**, callback URI `https://<portal-domain>/auth/callback`, JavaScript origin `https://<portal-domain>`, logout URI `https://<portal-domain>/`. Copy client id/secret → `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` / `_SECRET`, and the shop id → `SHOPIFY_SHOP_ID`.
5. Test end to end on a development store with the Bogus Gateway: buy, refund, cancel, failed card. Watch Admin → Shopify events.

## 3. Vercel
1. New project → import the repo → **Root Directory `advent-portal`**, framework Next.js, Node 24.
2. Build command: `pnpm build:vercel` (runs migrations with `DATABASE_URL_UNPOOLED`, then `next build`).
3. Function region: `iad1` (Washington, D.C.).
4. Environment variables (Production + Preview): everything in `.env.example`. Production must have `DEMO_MODE=false`, a fresh 32-byte `SESSION_SECRET` (`openssl rand -base64 32`), `APP_URL=https://<portal-domain>`, `ADVENT_YEAR`, `ADMIN_EMAILS`.
5. Domain: add e.g. `collectors.yourhouse.com`, then update the Shopify callback/origin/webhook URLs to it.
6. Firewall: rate-limit rules for `/auth/*` and `/api/webhooks/*`; enable Deployment Protection for previews.

## 4. Content and launch
1. Sign in at `/` with an `ADMIN_EMAILS` address (Shopify sends a code).
2. Admin → Artworks: upload all 24 works, fill title/artist/story/print SKU, leave unpublished; review, then publish.
3. Admin → Editions: numbers fill automatically as orders are paid.
4. Admin → Fulfillment: when you're ready to print, **Export** → send the CSV to the lab → enter tracking numbers as parcels ship.
5. Staging rehearsal: with `DEMO_MODE=true` on a preview, use the demo clock to walk Nov 30 → Dec 24.

## 5. Ongoing
- Failed webhooks are retried by Shopify for 48 h; fix the cause and Shopify's retry (or "Payment captured" re-send) re-processes safely.
- A collector who bought but sees "No collector edition": with the Admin API configured, signing in again re-reads their orders.
