CREATE TABLE "artwork" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" integer NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"medium" text DEFAULT '' NOT NULL,
	"dimensions" text DEFAULT '' NOT NULL,
	"year" integer,
	"description" text DEFAULT '' NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"image_key" text,
	"image_type" text,
	"width" integer,
	"height" integer,
	"accent" text,
	"print_sku" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_day_ck" CHECK ("artwork"."day" between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collector" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edition" (
	"number" integer PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"entitlement_id" uuid,
	"assigned_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "edition_number_ck" CHECK ("edition"."number" between 1 and 1000),
	CONSTRAINT "edition_status_ck" CHECK ("edition"."status" in ('available','assigned','retired')),
	CONSTRAINT "edition_assigned_ck" CHECK (("edition"."status" = 'assigned') = ("edition"."entitlement_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collector_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"edition_number" integer,
	"edition_assigned_at" timestamp with time zone,
	"review_reason" text,
	"revoked_reason" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_status_ck" CHECK ("entitlement"."status" in ('pending','active','revoked','needs_review'))
);
--> statement-breakpoint
CREATE TABLE "export_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" text NOT NULL,
	"order_count" integer NOT NULL,
	"csv" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fulfillment_order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"status" text NOT NULL,
	"hold_reason" text,
	"ship_to" jsonb,
	"print_count" integer DEFAULT 24 NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"export_batch_id" uuid,
	"lab_reference" text,
	"carrier" text,
	"tracking_number" text,
	"tracking_url" text,
	"submitted_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_status_ck" CHECK ("fulfillment_order"."status" in ('on_hold','ready','submitted','in_production','shipped','delivered','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "reveal_view" (
	"collector_id" uuid NOT NULL,
	"artwork_id" uuid NOT NULL,
	"first_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reveal_view_collector_id_artwork_id_pk" PRIMARY KEY("collector_id","artwork_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"collector_id" uuid,
	"email" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_order_id" text NOT NULL,
	"name" text NOT NULL,
	"collector_id" uuid,
	"email" text NOT NULL,
	"financial_status" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"refunds" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"shipping_address" jsonb,
	"processed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"topic" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"payload" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "edition" ADD CONSTRAINT "edition_entitlement_id_entitlement_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_collector_id_collector_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collector"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_order_id_shop_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_event" ADD CONSTRAINT "fulfillment_event_fulfillment_order_id_fulfillment_order_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_entitlement_id_entitlement_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_export_batch_id_export_batch_id_fk" FOREIGN KEY ("export_batch_id") REFERENCES "public"."export_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal_view" ADD CONSTRAINT "reveal_view_collector_id_collector_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collector"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reveal_view" ADD CONSTRAINT "reveal_view_artwork_id_artwork_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artwork"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_collector_id_collector_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collector"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_collector_id_collector_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collector"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_day_uq" ON "artwork" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "collector_shopify_uq" ON "collector" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collector_email_uq" ON "collector" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "edition_entitlement_uq" ON "edition" USING btree ("entitlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_order_uq" ON "entitlement" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_edition_uq" ON "entitlement" USING btree ("edition_number");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_one_active_uq" ON "entitlement" USING btree ("collector_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "fulfillment_entitlement_uq" ON "fulfillment_order" USING btree ("entitlement_id");--> statement-breakpoint
CREATE INDEX "fulfillment_status_idx" ON "fulfillment_order" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uq" ON "session" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_order_shopify_uq" ON "shop_order" USING btree ("shopify_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_uq" ON "webhook_event" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "webhook_event_received_idx" ON "webhook_event" USING btree ("received_at");