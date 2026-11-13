import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { artwork, collector, edition, entitlement, exportBatch, fulfillmentEvent, fulfillmentOrder, shopOrder, type FulfillmentStatus, type ShippingAddress } from "@/db/schema";
import { fulfillmentAdapter, type PrintJob } from "@/adapters/fulfillment";
import { env } from "@/lib/env";
import { trackingUrl } from "@/lib/tracking";
import { audit } from "./audit";

const PRINTS_PER_COLLECTION = 24;

/** Create THE print order for an entitlement. Idempotent: the unique index makes a second one impossible. */
export async function ensureFulfillment(tx: Tx, entitlementId: string, shipTo: ShippingAddress | null) {
  const status: FulfillmentStatus = shipTo ? "ready" : "on_hold";
  const inserted = await tx
    .insert(fulfillmentOrder)
    .values({ entitlementId, status, shipTo, holdReason: shipTo ? null : "Missing shipping address", printCount: PRINTS_PER_COLLECTION, provider: env.fulfillment.provider() })
    .onConflictDoNothing({ target: fulfillmentOrder.entitlementId })
    .returning({ id: fulfillmentOrder.id });
  if (inserted[0]) await tx.insert(fulfillmentEvent).values({ fulfillmentOrderId: inserted[0].id, status, actor: "system", note: "Created from paid order" });
  else {
    // Existing order that was cancelled by an earlier refund and the payment was re-captured: re-open it.
    await tx
      .update(fulfillmentOrder)
      .set({ status, holdReason: shipTo ? null : "Missing shipping address", updatedAt: new Date() })
      .where(and(eq(fulfillmentOrder.entitlementId, entitlementId), eq(fulfillmentOrder.status, "cancelled")));
  }
}

/** Refund / cancellation. Not yet at the lab → cancelled. Already at the lab → on hold for a human. */
export async function stopFulfillment(tx: Tx, entitlementId: string, reason: string) {
  const [fo] = await tx.select().from(fulfillmentOrder).where(eq(fulfillmentOrder.entitlementId, entitlementId)).for("update");
  if (!fo) return;
  if (fo.status === "ready" || fo.status === "on_hold") {
    await tx.update(fulfillmentOrder).set({ status: "cancelled", holdReason: reason, updatedAt: new Date() }).where(eq(fulfillmentOrder.id, fo.id));
    await tx.insert(fulfillmentEvent).values({ fulfillmentOrderId: fo.id, status: "cancelled", actor: "system", note: reason });
  } else if (fo.status === "submitted" || fo.status === "in_production") {
    const note = `${reason} after the order reached the print lab. Contact the lab to stop it.`;
    await tx.update(fulfillmentOrder).set({ status: "on_hold", holdReason: note, updatedAt: new Date() }).where(eq(fulfillmentOrder.id, fo.id));
    await tx.insert(fulfillmentEvent).values({ fulfillmentOrderId: fo.id, status: "on_hold", actor: "system", note });
  } else if (fo.status === "shipped" || fo.status === "delivered") {
    await tx.insert(fulfillmentEvent).values({ fulfillmentOrderId: fo.id, status: fo.status, actor: "system", note: `${reason} after shipping — arrange a return if needed.` });
  }
}

async function loadJobs(tx: Tx, ids: string[]): Promise<PrintJob[]> {
  if (!ids.length) return [];
  const rows = await tx
    .select({ fo: fulfillmentOrder, ord: shopOrder, c: collector, number: edition.number })
    .from(fulfillmentOrder)
    .innerJoin(entitlement, eq(entitlement.id, fulfillmentOrder.entitlementId))
    .innerJoin(shopOrder, eq(shopOrder.id, entitlement.orderId))
    .innerJoin(collector, eq(collector.id, entitlement.collectorId))
    .leftJoin(edition, eq(edition.entitlementId, entitlement.id))
    .where(inArray(fulfillmentOrder.id, ids))
    .orderBy(asc(edition.number));
  const prints = await tx.select({ day: artwork.day, sku: artwork.printSku, title: artwork.title }).from(artwork).orderBy(asc(artwork.day));
  return rows.map((r) => ({
    fulfillmentOrderId: r.fo.id,
    orderName: r.ord.name,
    editionNumber: r.number,
    editionSize: env.editionSize(),
    collectorName: [r.c.firstName, r.c.lastName].filter(Boolean).join(" "),
    email: r.c.email,
    shipTo: r.fo.shipTo!,
    prints,
  }));
}

/**
 * Export every READY order to the print lab exactly once. Rows are locked (SKIP LOCKED) and flipped
 * ready → submitted in the same transaction, so two admins exporting at once never export a row twice.
 */
export async function exportReadyOrders(actor: string) {
  return db.transaction(async (tx) => {
    const ready = await tx.execute<{ id: string }>(sql`select id from fulfillment_order where status = 'ready' and ship_to is not null order by created_at for update skip locked`);
    const ids = ready.map((r) => r.id);
    if (!ids.length) return null;
    const jobs = await loadJobs(tx, ids);
    if (jobs.some((j) => j.prints.length !== PRINTS_PER_COLLECTION)) throw new Error(`All ${PRINTS_PER_COLLECTION} artworks (with print SKUs) must exist before exporting.`);
    const adapter = fulfillmentAdapter();
    const result = await adapter.submit(jobs);
    const csv = result.mode === "export" ? result.csv : JSON.stringify(result.references);
    const [batch] = await tx.insert(exportBatch).values({ createdBy: actor, orderCount: ids.length, csv }).returning();
    const now = new Date();
    for (const id of ids) {
      const labReference = result.mode === "api" ? (result.references[id] ?? null) : null;
      await tx
        .update(fulfillmentOrder)
        .set({ status: "submitted", submittedAt: now, exportBatchId: batch!.id, labReference, updatedAt: now })
        .where(and(eq(fulfillmentOrder.id, id), eq(fulfillmentOrder.status, "ready")));
      await tx.insert(fulfillmentEvent).values({ fulfillmentOrderId: id, status: "submitted", actor, note: `Sent to ${adapter.label} (batch ${batch!.id.slice(0, 8)})` });
    }
    await audit(actor, "fulfillment.export", batch!.id, { count: ids.length }, tx);
    return { batchId: batch!.id, count: ids.length, filename: result.mode === "export" ? result.filename : `batch-${batch!.id}.json`, csv };
  });
}

const NEXT: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  on_hold: ["ready", "cancelled"],
  ready: ["on_hold", "cancelled"],
  submitted: ["in_production", "shipped", "on_hold"],
  in_production: ["shipped", "on_hold"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: ["ready"],
};
export const allowedNext = (s: FulfillmentStatus) => NEXT[s];

export async function updateFulfillment(
  id: string,
  actor: string,
  input: { status?: FulfillmentStatus; carrier?: string; trackingNumber?: string; note?: string; shipTo?: ShippingAddress },
) {
  return db.transaction(async (tx) => {
    const [fo] = await tx.select().from(fulfillmentOrder).where(eq(fulfillmentOrder.id, id)).for("update");
    if (!fo) return { ok: false as const, error: "Order not found" };
    const patch: Partial<typeof fulfillmentOrder.$inferInsert> = { updatedAt: new Date() };
    let status = input.status;
    if (input.shipTo) patch.shipTo = input.shipTo;
    if (input.trackingNumber && input.carrier) {
      patch.carrier = input.carrier;
      patch.trackingNumber = input.trackingNumber.trim();
      patch.trackingUrl = trackingUrl(input.carrier, input.trackingNumber);
      if (!status && (fo.status === "submitted" || fo.status === "in_production")) status = "shipped";
    }
    if (status && status !== fo.status) {
      if (!NEXT[fo.status].includes(status)) return { ok: false as const, error: `Can't move from ${fo.status} to ${status}` };
      if (status === "ready" && !(input.shipTo ?? fo.shipTo)) return { ok: false as const, error: "Add a shipping address first" };
      if (status === "ready") {
        const [ent] = await tx.select({ s: entitlement.status }).from(entitlement).where(eq(entitlement.id, fo.entitlementId));
        if (ent?.s !== "active") return { ok: false as const, error: "The collector's access is not active (refunded or under review)" };
      }
      patch.status = status;
      if (status === "shipped") patch.shippedAt = new Date();
      if (status === "delivered") patch.deliveredAt = new Date();
      if (status === "ready") patch.holdReason = null;
    }
    await tx.update(fulfillmentOrder).set(patch).where(eq(fulfillmentOrder.id, id));
    await tx.insert(fulfillmentEvent).values({ fulfillmentOrderId: id, status: patch.status ?? fo.status, actor, note: input.note ?? (patch.trackingNumber ? `${patch.carrier} ${patch.trackingNumber}` : null) });
    await audit(actor, "fulfillment.update", id, { ...input, shipTo: input.shipTo ? "updated" : undefined }, tx);
    return { ok: true as const };
  });
}
