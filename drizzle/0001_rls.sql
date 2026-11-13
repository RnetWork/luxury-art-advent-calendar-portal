-- Row Level Security ON, no policies: Supabase's anon/authenticated keys (PostgREST) can read or write nothing.
-- The app connects as the database owner over a direct Postgres connection, which bypasses RLS.
ALTER TABLE "collector" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shop_order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entitlement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "edition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artwork" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reveal_view" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "export_batch" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fulfillment_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
