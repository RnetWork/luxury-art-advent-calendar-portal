import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { edition, entitlement, fulfillmentOrder, shopOrder, webhookEvent } from "@/db/schema";
import { shopifyHmac } from "@/lib/crypto";
import { demoRefundPayload } from "@/lib/demo-orders";
import { exportReadyOrders, updateFulfillment } from "@/server/fulfillment";
import { handleShopifyEvent, ingestShopifyWebhook } from "@/server/orders";
import { assignSpecificEdition, releaseEdition } from "@/server/editions";
import { order, persona, resetDb, seedArtworks } from "./helpers";

const SECRET = "test-webhook-secret";
const send = (topic: string, payload: unknown, webhookId = randomUUID(), secret = SECRET) => {
  const rawBody = JSON.stringify(payload);
  return ingestShopifyWebhook({ rawBody, hmac: shopifyHmac(rawBody, secret), topic, webhookId, shopDomain: "demo.myshopify.com" });
};
const entFor = async (orderPayload: { id: number }) => {
  const [o] = await db.select().from(shopOrder).where(eq(shopOrder.shopifyOrderId, String(orderPayload.id)));
  const [e] = await db.select().from(entitlement).where(eq(entitlement.orderId, o!.id));
  const [f] = await db.select().from(fulfillmentOrder).where(eq(fulfillmentOrder.entitlementId, e!.id));
  return { order: o!, ent: e!, fo: f ?? null };
};

beforeEach(async () => {
  await resetDb();
  await seedArtworks();
});

describe("verified, idempotent webhooks", () => {
  it("rejects a bad signature without touching the database", async () => {
    const res = await send("orders/paid", order(persona()), randomUUID(), "wrong-secret");
    expect(res.status).toBe(401);
    expect((await db.select({ n: count() }).from(webhookEvent))[0]!.n).toBe(0);
  });

  it("grants access, an edition and ONE print order on payment", async () => {
    const o = order(persona());
    expect((await send("orders/paid", o)).status).toBe(200);
    const { ent, fo } = await entFor(o);
    expect(ent.status).toBe("active");
    expect(ent.editionNumber).toBe(1);
    expect(fo?.status).toBe("ready");
    expect(fo?.printCount).toBe(24);
  });

  it("processes a replayed webhook id only once", async () => {
    const o = order(persona());
    const id = randomUUID();
    expect((await send("orders/paid", o, id)).body).toBe("processed");
    expect((await send("orders/paid", o, id)).body).toBe("duplicate");
    expect((await db.select({ n: count() }).from(entitlement))[0]!.n).toBe(1);
    expect((await db.select({ n: count() }).from(fulfillmentOrder))[0]!.n).toBe(1);
  });

  it("never creates a second print order, even for the same order paid via different events", async () => {
    const o = order(persona());
    await send("orders/paid", o);
    await send("orders/updated", o);
    await send("orders/paid", o);
    expect((await db.select({ n: count() }).from(fulfillmentOrder))[0]!.n).toBe(1);
    expect((await db.select({ n: count() }).from(edition).where(eq(edition.status, "assigned")))[0]!.n).toBe(1);
  });

  it("ignores orders without the collection product", async () => {
    const o = order(persona());
    o.line_items = [{ variant_id: "other-product", quantity: 1, title: "Poster" }];
    expect((await send("orders/paid", o)).body).toBe("ignored");
  });
});

describe("payment lifecycle", () => {
  it("pending → no access; then paid → access", async () => {
    const p = persona();
    const o = order(p, "pending");
    await send("orders/create", o);
    expect((await entFor(o)).ent.status).toBe("pending");
    expect((await entFor(o)).ent.editionNumber).toBeNull();
    await send("orders/paid", { ...o, financial_status: "paid" });
    expect((await entFor(o)).ent.status).toBe("active");
  });

  it("a stale pending event arriving after payment does not downgrade access", async () => {
    const o = order(persona());
    await send("orders/paid", o);
    await send("orders/create", { ...o, financial_status: "pending" });
    const { ent, order: row } = await entFor(o);
    expect(ent.status).toBe("active");
    expect(row.financialStatus).toBe("paid");
  });

  it("failed/voided payment revokes a pending order", async () => {
    const o = order(persona(), "pending");
    await send("orders/create", o);
    await send("orders/updated", { ...o, financial_status: "voided" });
    expect((await entFor(o)).ent.status).toBe("revoked");
  });

  it("full refund revokes access, retires the edition and cancels the print order", async () => {
    const o = order(persona());
    await send("orders/paid", o);
    await send("refunds/create", demoRefundPayload({ refundId: "1", orderId: String(o.id), amount: "4999.00" }));
    const { ent, fo } = await entFor(o);
    expect(ent.status).toBe("revoked");
    expect(ent.revokedReason).toBe("refunded");
    expect(fo?.status).toBe("cancelled");
    const [ed] = await db.select().from(edition).where(eq(edition.number, 1));
    expect(ed?.status).toBe("retired");
  });

  it("counts each refund once, and a partial refund keeps access (flagged)", async () => {
    const o = order(persona());
    await send("orders/paid", o);
    const r = demoRefundPayload({ refundId: "77", orderId: String(o.id), amount: "500.00" });
    await send("refunds/create", r);
    await send("refunds/create", r); // different webhook id, same refund
    const { ent, order: row } = await entFor(o);
    expect(row.refundedCents).toBe(50_000);
    expect(ent.status).toBe("active");
    expect(ent.reviewReason).toBe("partial_refund");
  });

  it("a refund after the order reached the lab puts it on hold instead of cancelling", async () => {
    const o = order(persona());
    await send("orders/paid", o);
    await exportReadyOrders("test");
    await send("refunds/create", demoRefundPayload({ refundId: "2", orderId: String(o.id), amount: "4999.00" }));
    const { fo } = await entFor(o);
    expect(fo?.status).toBe("on_hold");
    expect(fo?.holdReason).toMatch(/print lab/);
  });

  it("cancellation revokes; a later 'paid' event does not silently re-grant access", async () => {
    const o = order(persona());
    await send("orders/paid", o);
    await send("orders/cancelled", { ...o, cancelled_at: new Date().toISOString() });
    await send("orders/paid", o);
    expect((await entFor(o)).ent.status).toBe("revoked");
  });

  it("a second collection by the same collector goes to review (one collection per collector)", async () => {
    const p = persona();
    await send("orders/paid", order(p));
    const second = order(p);
    await send("orders/paid", second);
    const { ent, fo } = await entFor(second);
    expect(ent.status).toBe("needs_review");
    expect(ent.reviewReason).toBe("second_order");
    expect(fo).toBeNull();
  });

  it("orders without a shipping address go on hold", async () => {
    const o = order(persona(), "paid", { withAddress: false });
    await send("orders/paid", o);
    expect((await entFor(o)).fo?.status).toBe("on_hold");
  });
});

describe("edition numbers", () => {
  it("assigns 100 unique numbers to 120 concurrent buyers; the rest go to review", async () => {
    const orders = Array.from({ length: 120 }, () => order(persona()));
    await Promise.all(orders.map((o) => handleShopifyEvent("orders/paid", o)));
    const ents = await db.select().from(entitlement);
    const numbers = ents.filter((e) => e.status === "active").map((e) => e.editionNumber);
    expect(numbers).toHaveLength(100);
    expect(new Set(numbers).size).toBe(100);
    expect(Math.min(...(numbers as number[]))).toBe(1);
    expect(Math.max(...(numbers as number[]))).toBe(100);
    expect(ents.filter((e) => e.reviewReason === "sold_out")).toHaveLength(20);
    expect((await db.select({ n: count() }).from(fulfillmentOrder))[0]!.n).toBe(100);
  });

  it("admin can move a collector to a specific free number, never to a taken one", async () => {
    const a = order(persona());
    const b = order(persona());
    await handleShopifyEvent("orders/paid", a);
    await handleShopifyEvent("orders/paid", b);
    const { ent: ea } = await entFor(a);
    expect(await db.transaction((tx) => assignSpecificEdition(tx, ea.id, 2))).toMatchObject({ ok: false });
    expect(await db.transaction((tx) => assignSpecificEdition(tx, ea.id, 24))).toEqual({ ok: true });
    expect((await entFor(a)).ent.editionNumber).toBe(24);
    const [freed] = await db.select().from(edition).where(eq(edition.number, 1));
    expect(freed?.status).toBe("available");
  });

  it("a retired number can be released and is then re-used", async () => {
    const a = order(persona());
    await handleShopifyEvent("orders/paid", a);
    await handleShopifyEvent("orders/cancelled", { ...a, cancelled_at: new Date().toISOString() });
    expect(await db.transaction((tx) => releaseEdition(tx, 1))).toBe(true);
    const b = order(persona());
    await handleShopifyEvent("orders/paid", b);
    expect((await entFor(b)).ent.editionNumber).toBe(1);
  });
});

describe("fulfillment export", () => {
  it("exports each ready order exactly once, 24 rows per collector", async () => {
    for (let i = 0; i < 3; i++) await handleShopifyEvent("orders/paid", order(persona()));
    const first = await exportReadyOrders("test");
    expect(first?.count).toBe(3);
    expect(first!.csv.trim().split("\r\n")).toHaveLength(1 + 3 * 24);
    expect(await exportReadyOrders("test")).toBeNull();
  });

  it("two simultaneous exports never export the same order twice", async () => {
    for (let i = 0; i < 6; i++) await handleShopifyEvent("orders/paid", order(persona()));
    const [a, b] = await Promise.all([exportReadyOrders("a"), exportReadyOrders("b")]);
    expect((a?.count ?? 0) + (b?.count ?? 0)).toBe(6);
    const submitted = await db.select({ n: count() }).from(fulfillmentOrder).where(eq(fulfillmentOrder.status, "submitted"));
    expect(submitted[0]!.n).toBe(6);
  });

  it("tracking moves a submitted order to shipped and builds the carrier link", async () => {
    const o = order(persona());
    await handleShopifyEvent("orders/paid", o);
    await exportReadyOrders("test");
    const { fo } = await entFor(o);
    expect(await updateFulfillment(fo!.id, "test", { carrier: "FedEx", trackingNumber: "123456789012" })).toEqual({ ok: true });
    const after = (await entFor(o)).fo!;
    expect(after.status).toBe("shipped");
    expect(after.trackingUrl).toContain("fedex.com");
    expect(await updateFulfillment(fo!.id, "test", { status: "ready" })).toMatchObject({ ok: false });
  });
});
