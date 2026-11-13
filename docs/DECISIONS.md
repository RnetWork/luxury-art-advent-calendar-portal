# Decisions

| # | Decision | Why |
|---|---|---|
| A-1 | Standalone app in `advent-portal/` (own package, config, DB), not inside the CRM | Different product, stack (Supabase, Shopify login) and users. Moves to its own repo with `git subtree split` or a copy. |
| A-2 | Drizzle + `postgres.js` over Supabase's Postgres, no Supabase JS client | All access is server-side; a direct connection keeps one data path, typed queries and real transactions (needed for atomic editions). Same code runs on the local Docker Postgres. |
| A-3 | RLS on, zero policies | The anon key (if ever used or leaked) can't read collectors, orders or artwork keys. |
| A-4 | Own session after Shopify login (not Shopify tokens in the browser) | Shopify proves identity once; access is decided by our entitlement table on every request, so refunds take effect immediately. |
| A-5 | Admins sign in through Shopify too, allowed by `ADMIN_EMAILS` | No second password system; Shopify verifies the email. |
| A-6 | One collection per collector; a second paid order → `needs_review` | The brief says each collector receives one collection. The owner refunds or arranges a gift in Shopify. Quantity > 1 in one order is granted but flagged. |
| A-7 | Refunded/cancelled editions are **retired**, not re-issued automatically | Collectors expect numbers to be final; the admin can release a number deliberately. |
| A-8 | Edition = lowest free number at payment time | Simple, fair, explainable. Admin can move a collector to a specific free number. |
| A-9 | Paid after sold out → `needs_review` (`sold_out`), no access | Safer than overselling; the owner refunds or releases a retired number and retries. |
| A-10 | Refund after export → fulfillment `on_hold` with a note, not silently cancelled | The print lab must be contacted by a human. |
| A-11 | Fulfillment via CSV export (`manual` adapter), one row per print | No confirmed lab API. Rows are flipped `ready → submitted` in the same locked transaction as the export, so nothing is printed twice. |
| A-12 | Unlock computed on request (no cron) | Nothing can fail to run at midnight; the server compares `now` with Dec N 00:00 New York. |
| A-13 | Unpublished artwork stays hidden after its unlock time ("being prepared") | Lets the owner hold a door if an asset isn't ready, without leaking a draft. |
| A-14 | Demo clock + event simulator only in demo mode, forced off on Vercel production | Makes the 24-day experience testable in minutes without weakening production. |
| A-15 | Artwork uploads go browser → storage via a short-lived signed upload URL | Vercel functions accept at most 4.5 MB per request; print-resolution files are larger. |
| A-16 | Calendar doors in a fixed scattered order with a "Open today's door" button | Feels like a real advent calendar; the button keeps today one tap away on a phone. |
