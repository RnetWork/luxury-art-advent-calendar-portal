import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { collector, entitlement, shopOrder, webhookEvent } from "@/db/schema";
import { ordersAdapter } from "@/adapters/orders";
import { env } from "@/lib/env";
import { verifyShopifyHmac } from "@/lib/crypto";
import { financialRank, normalizeWebhookOrder, orderOutcome, refundCents, type NormalizedOrder } from "@/lib/shopify-order";
import { audit } from "./audit";
import { claimEdition, retireEdition } from "./editions";
import { ensureFulfillment, stopFulfillment } from "./fulfillment";

export const HANDLED_TOPICS = ["orders/create", "orders/updated", "orders/paid", "orders/cancelled", "refunds/create"] as const;

// ─── Webhook intake ─────────────────────────────────────────────────────────────

export type WebhookResult = { status: number; body: string };

/**
 * Verify → dedupe → process. Returns 200 for duplicates and ignored topics (so Shopify stops retrying),
 * 401 for bad signatures, 500 when processing failed (Shopify retries; processing is idempotent).
 */
export async function ingestShopifyWebhook(input: { rawBody: string; hmac: string | null; topic: string | null; webhookId: string | null; shopDomain: string | null }): Promise<WebhookResult> {
  const secret = env.shopify.webhookSecret();
  if (!secret || !verifyShopifyHmac(input.rawBody, input.hmac, secret)) return { status: 401, body: "invalid signature" };
  const expectedShop = env.shopify.storeDomain();
  if (expectedShop && input.shopDomain && input.shopDomain.toLowerCase() !== expectedShop.toLowerCase()) return { status: 401, body: "unknown shop" };
  if (!input.topic || !input.webhookId) return { status: 400, body: "missing headers" };

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }

  const [inserted] = await db
    .insert(webhookEvent)
    .values({ source: "shopify", externalId: input.webhookId, topic: input.topic, payload: redact(payload) })
    .onConflictDoNothing({ target: [webhookEvent.source, webhookEvent.externalId] })
    .returning({ id: webhookEvent.id });
  let eventId = inserted?.id;
  if (!eventId) {
    const [existing] = await db.select().from(webhookEvent).where(and(eq(webhookEvent.source, "shopify"), eq(webhookEvent.externalId, input.webhookId)));
    if (existing && existing.status !== "failed") return { status: 200, body: "duplicate" };
    eventId = existing?.id; // a previous attempt failed: process again (safe, processing is idempotent)
  }

  try {
    const outcome = await handleShopifyEvent(input.topic, payload);
    await db.update(webhookEvent).set({ status: outcome, processedAt: new Date(), error: null }).where(eq(webhookEvent.id, eventId!));
    return { status: 200, body: outcome };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(webhookEvent).set({ status: "failed", error: message.slice(0, 500) }).where(eq(webhookEvent.id, eventId!));
    console.error("[shopify webhook] failed", input.topic, message);
    return { status: 500, body: "processing failed" };
  }
}

/** Keep the event log useful without storing full addresses/phones in it. */
function redact(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  return { id: p.id, name: p.name, order_id: p.order_id, financial_status: p.financial_status, cancelled_at: p.cancelled_at, total_price: p.total_price };
}

export async function handleShopifyEvent(topic: string, payload: unknown): Promise<"processed" | "ignored"> {
  const adapter = ordersAdapter();
  if (topic.startsWith("orders/")) {
    const fromHook = normalizeWebhookOrder(payload);
    const authoritative = adapter.live ? await adapter.fetchOrder(fromHook.shopifyOrderId) : null;
    return syncOrder(authoritative ?? fromHook, { refundedCents: authoritative?.refundedCents });
  }
  if (topic === "refunds/create") {
    const refund = refundCents(payload);
    const authoritative = adapter.live ? await adapter.fetchOrder(refund.orderId) : null;
    if (authoritative) return syncOrder(authoritative, { refundedCents: authoritative.refundedCents });
    return applyRefund(refund);
  }
  return "ignored";
}

// ─── Order → entitlement ────────────────────────────────────────────────────────

const collectionQuantity = (o: NormalizedOrder) => {
  const ids = env.shopify.collectionVariantIds();
  return o.lineItems.filter((li) => ids.includes(li.variantId)).reduce((s, li) => s + li.quantity, 0);
};

/** Find or create the collector for an order (by Shopify customer id, then by email). */
export async function upsertCollector(tx: Tx, p: { shopifyCustomerId: string | null; email: string; firstName: string | null; lastName: string | null }) {
  const email = p.email.toLowerCase();
  const key = p.shopifyCustomerId ?? `email:${email}`;
  const [byId] = await tx.select().from(collector).where(eq(collector.shopifyCustomerId, key));
  if (byId) return byId.id;
  const [byEmail] = await tx.select().from(collector).where(sql`lower(${collector.email}) = ${email}`);
  if (byEmail) {
    if (p.shopifyCustomerId && byEmail.shopifyCustomerId.startsWith("email:")) {
      await tx.update(collector).set({ shopifyCustomerId: p.shopifyCustomerId }).where(eq(collector.id, byEmail.id));
    }
    return byEmail.id;
  }
  const [created] = await tx.insert(collector).values({ shopifyCustomerId: key, email, firstName: p.firstName, lastName: p.lastName }).returning({ id: collector.id });
  return created!.id;
}

export async function syncOrder(order: NormalizedOrder, opts: { refundedCents?: number } = {}): Promise<"processed" | "ignored"> {
  const qty = collectionQuantity(order);
  if (qty === 0) return "ignored";
  if (!order.email) throw new Error(`Order ${order.name} has no email`);

  return db.transaction(async (tx) => {
    const collectorId = await upsertCollector(tx, { shopifyCustomerId: order.customer.id, email: order.email, firstName: order.customer.firstName, lastName: order.customer.lastName });
    await tx
      .insert(shopOrder)
      .values({
        shopifyOrderId: order.shopifyOrderId,
        name: order.name,
        collectorId,
        email: order.email,
        financialStatus: order.financialStatus,
        cancelledAt: order.cancelledAt,
        totalCents: order.totalCents,
        refundedCents: opts.refundedCents ?? 0,
        currency: order.currency,
        quantity: qty,
        shippingAddress: order.shippingAddress,
      })
      .onConflictDoNothing({ target: shopOrder.shopifyOrderId });
    // Row lock: events for the same order are applied one at a time.
    const [row] = await tx.select().from(shopOrder).where(eq(shopOrder.shopifyOrderId, order.shopifyOrderId)).for("update");
    const merged = {
      // Out-of-order delivery: an older, lower-ranked status never downgrades a newer one.
      financialStatus: financialRank(order.financialStatus) >= financialRank(row!.financialStatus) ? order.financialStatus : row!.financialStatus,
      cancelledAt: row!.cancelledAt ?? order.cancelledAt,
      refundedCents: Math.max(opts.refundedCents ?? 0, row!.refundedCents),
      totalCents: order.totalCents || row!.totalCents,
      shippingAddress: order.shippingAddress ?? row!.shippingAddress,
    };
    await tx
      .update(shopOrder)
      .set({ ...merged, collectorId, quantity: qty, email: order.email, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(shopOrder.id, row!.id));
    await reconcileEntitlement(tx, { ...row!, ...merged, collectorId, quantity: qty });
    return "processed" as const;
  });
}

async function applyRefund(r: { refundId: string; orderId: string; cents: number }): Promise<"processed" | "ignored"> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(shopOrder).where(eq(shopOrder.shopifyOrderId, r.orderId)).for("update");
    if (!row) return "ignored" as const; // not a collection order
    if (row.refunds[r.refundId] !== undefined) return "processed" as const; // already counted
    const refunds = { ...row.refunds, [r.refundId]: r.cents };
    const refundedCents = Object.values(refunds).reduce((s, c) => s + c, 0);
    const full = row.totalCents > 0 && refundedCents >= row.totalCents;
    const financialStatus = full ? "refunded" : financialRank(row.financialStatus) >= 3 ? row.financialStatus : "partially_refunded";
    await tx.update(shopOrder).set({ refunds, refundedCents, financialStatus, updatedAt: new Date() }).where(eq(shopOrder.id, row.id));
    await reconcileEntitlement(tx, { ...row, refunds, refundedCents, financialStatus });
    return "processed" as const;
  });
}

type OrderRow = typeof shopOrder.$inferSelect;

async function reconcileEntitlement(tx: Tx, order: OrderRow) {
  const { outcome, reason } = orderOutcome(order);
  const collectorId = order.collectorId!;
  const [ent] = await tx.select().from(entitlement).where(eq(entitlement.orderId, order.id)).for("update");

  if (!ent) {
    const [created] = await tx
      .insert(entitlement)
      .values({ collectorId, orderId: order.id, status: outcome === "active" ? "pending" : outcome, revokedReason: outcome === "revoked" ? reason : null, revokedAt: outcome === "revoked" ? new Date() : null })
      .returning();
    if (outcome === "active") await activate(tx, created!, order);
    return;
  }

  if (outcome === "active" && (ent.status === "pending" || (ent.status === "needs_review" && ent.reviewReason === "sold_out"))) {
    await activate(tx, ent, order);
  } else if (outcome === "active" && ent.status === "active" && order.refundedCents > 0) {
    await tx.update(entitlement).set({ reviewReason: "partial_refund" }).where(eq(entitlement.id, ent.id));
    await audit("shopify", "order.partial_refund", order.name, { refundedCents: order.refundedCents }, tx);
  } else if (outcome === "revoked" && ent.status !== "revoked") {
    await tx.update(entitlement).set({ status: "revoked", revokedReason: reason, revokedAt: new Date() }).where(eq(entitlement.id, ent.id));
    await retireEdition(tx, ent.id, `Retired: ${order.name} ${reason}`);
    await stopFulfillment(tx, ent.id, reason === "refunded" ? "Order refunded" : reason === "order_cancelled" ? "Order cancelled" : "Payment failed");
    await audit("shopify", "entitlement.revoked", order.name, { reason }, tx);
  } else if (outcome === "active" && ent.status === "revoked") {
    // Never silently re-grant access after a refund/cancel: an admin decides.
    await audit("shopify", "order.paid_after_revoke", order.name, { financialStatus: order.financialStatus }, tx);
  }
}

async function activate(tx: Tx, ent: typeof entitlement.$inferSelect, order: OrderRow) {
  // One complete collection per collector: a second paid order goes to review (refund or gift).
  const [other] = await tx
    .select({ id: entitlement.id })
    .from(entitlement)
    .where(and(eq(entitlement.collectorId, ent.collectorId), eq(entitlement.status, "active"), ne(entitlement.id, ent.id)));
  if (other) {
    await tx.update(entitlement).set({ status: "needs_review", reviewReason: "second_order" }).where(eq(entitlement.id, ent.id));
    await audit("shopify", "entitlement.second_order", order.name, {}, tx);
    return;
  }
  await tx
    .update(entitlement)
    .set({ status: "active", reviewReason: order.quantity > 1 ? `quantity_${order.quantity}` : null })
    .where(eq(entitlement.id, ent.id));
  const number = await claimEdition(tx, ent.id);
  if (number == null) {
    await tx.update(entitlement).set({ status: "needs_review", reviewReason: "sold_out" }).where(eq(entitlement.id, ent.id));
    await audit("shopify", "edition.sold_out", order.name, {}, tx);
    return;
  }
  await ensureFulfillment(tx, ent.id, order.shippingAddress);
  await audit("shopify", "entitlement.activated", order.name, { edition: number }, tx);
}
