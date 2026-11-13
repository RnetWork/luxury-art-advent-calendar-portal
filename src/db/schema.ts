import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export type ShippingAddress = {
  name: string;
  company?: string | null;
  address1: string;
  address2?: string | null;
  city: string;
  province?: string | null;
  zip: string;
  country: string;
  countryCode?: string | null;
  phone?: string | null;
};

export const collector = pgTable(
  "collector",
  {
    id: id(),
    shopifyCustomerId: text("shopify_customer_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("collector_shopify_uq").on(t.shopifyCustomerId), uniqueIndex("collector_email_uq").on(sql`lower(${t.email})`)],
);

export const session = pgTable(
  "session",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    collectorId: uuid("collector_id").references(() => collector.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    isAdmin: boolean("is_admin").notNull().default(false),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("session_token_uq").on(t.tokenHash)],
);

export const ORDER_FINANCIAL = ["pending", "authorized", "partially_paid", "paid", "partially_refunded", "refunded", "voided", "expired", "failed"] as const;

export const shopOrder = pgTable(
  "shop_order",
  {
    id: id(),
    shopifyOrderId: text("shopify_order_id").notNull(),
    name: text("name").notNull(),
    collectorId: uuid("collector_id").references(() => collector.id),
    email: text("email").notNull(),
    financialStatus: text("financial_status").notNull(),
    cancelledAt: ts("cancelled_at"),
    totalCents: integer("total_cents").notNull().default(0),
    refundedCents: integer("refunded_cents").notNull().default(0),
    /** Refunds already counted (Shopify refund id → cents), so a replayed refund is never added twice. */
    refunds: jsonb("refunds").$type<Record<string, number>>().notNull().default({}),
    currency: text("currency").notNull().default("USD"),
    quantity: integer("quantity").notNull().default(1),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress | null>(),
    processedAt: ts("processed_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shop_order_shopify_uq").on(t.shopifyOrderId)],
);

export const ENTITLEMENT_STATUS = ["pending", "active", "revoked", "needs_review"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUS)[number];

export const entitlement = pgTable(
  "entitlement",
  {
    id: id(),
    collectorId: uuid("collector_id")
      .notNull()
      .references(() => collector.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id),
    status: text("status").$type<EntitlementStatus>().notNull(),
    editionNumber: integer("edition_number"),
    editionAssignedAt: ts("edition_assigned_at"),
    reviewReason: text("review_reason"),
    revokedReason: text("revoked_reason"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("entitlement_order_uq").on(t.orderId),
    uniqueIndex("entitlement_edition_uq").on(t.editionNumber),
    // One active collection per collector.
    uniqueIndex("entitlement_one_active_uq").on(t.collectorId).where(sql`status = 'active'`),
    check("entitlement_status_ck", sql`${t.status} in ('pending','active','revoked','needs_review')`),
  ],
);

export const edition = pgTable(
  "edition",
  {
    number: integer("number").primaryKey(),
    status: text("status").$type<"available" | "assigned" | "retired">().notNull().default("available"),
    entitlementId: uuid("entitlement_id").references(() => entitlement.id),
    assignedAt: ts("assigned_at"),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("edition_entitlement_uq").on(t.entitlementId),
    check("edition_number_ck", sql`${t.number} between 1 and 1000`),
    check("edition_status_ck", sql`${t.status} in ('available','assigned','retired')`),
    check("edition_assigned_ck", sql`(${t.status} = 'assigned') = (${t.entitlementId} is not null)`),
  ],
);

export const artwork = pgTable(
  "artwork",
  {
    id: id(),
    day: integer("day").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    medium: text("medium").notNull().default(""),
    dimensions: text("dimensions").notNull().default(""),
    year: integer("year"),
    description: text("description").notNull().default(""),
    story: text("story").notNull().default(""),
    imageKey: text("image_key"),
    imageType: text("image_type"),
    width: integer("width"),
    height: integer("height"),
    accent: text("accent"),
    printSku: text("print_sku").notNull(),
    published: boolean("published").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("artwork_day_uq").on(t.day), check("artwork_day_ck", sql`${t.day} between 1 and 24`)],
);

export const revealView = pgTable(
  "reveal_view",
  {
    collectorId: uuid("collector_id")
      .notNull()
      .references(() => collector.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artwork.id, { onDelete: "cascade" }),
    firstViewedAt: ts("first_viewed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectorId, t.artworkId] })],
);

export const FULFILLMENT_STATUS = ["on_hold", "ready", "submitted", "in_production", "shipped", "delivered", "cancelled"] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUS)[number];

export const exportBatch = pgTable("export_batch", {
  id: id(),
  createdBy: text("created_by").notNull(),
  orderCount: integer("order_count").notNull(),
  csv: text("csv").notNull(),
  createdAt: createdAt(),
});

export const fulfillmentOrder = pgTable(
  "fulfillment_order",
  {
    id: id(),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .references(() => entitlement.id),
    status: text("status").$type<FulfillmentStatus>().notNull(),
    holdReason: text("hold_reason"),
    shipTo: jsonb("ship_to").$type<ShippingAddress | null>(),
    printCount: integer("print_count").notNull().default(24),
    provider: text("provider").notNull().default("manual"),
    exportBatchId: uuid("export_batch_id").references(() => exportBatch.id),
    labReference: text("lab_reference"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    submittedAt: ts("submitted_at"),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    // The guarantee against duplicate fulfillment: one print order per entitlement, ever.
    uniqueIndex("fulfillment_entitlement_uq").on(t.entitlementId),
    index("fulfillment_status_idx").on(t.status),
    check("fulfillment_status_ck", sql`${t.status} in ('on_hold','ready','submitted','in_production','shipped','delivered','cancelled')`),
  ],
);

export const fulfillmentEvent = pgTable("fulfillment_event", {
  id: id(),
  fulfillmentOrderId: uuid("fulfillment_order_id")
    .notNull()
    .references(() => fulfillmentOrder.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note"),
  actor: text("actor").notNull(),
  createdAt: createdAt(),
});

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: id(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    topic: text("topic").notNull(),
    status: text("status").$type<"received" | "processed" | "ignored" | "failed">().notNull().default("received"),
    error: text("error"),
    payload: jsonb("payload"),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
  },
  (t) => [uniqueIndex("webhook_event_uq").on(t.source, t.externalId), index("webhook_event_received_idx").on(t.receivedAt)],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: createdAt(),
});
