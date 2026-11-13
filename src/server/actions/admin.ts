"use server";

import { randomUUID } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { artwork, entitlement, FULFILLMENT_STATUS, shopOrder } from "@/db/schema";
import { storage } from "@/adapters/storage";
import { env } from "@/lib/env";
import { shopifyHmac } from "@/lib/crypto";
import { DEMO_PERSONAS, demoOrderPayload, demoRefundPayload, extraPersonas } from "@/lib/demo-orders";
import { CARRIERS } from "@/lib/tracking";
import { audit } from "@/server/audit";
import { assignSpecificEdition, claimEdition, releaseEdition } from "@/server/editions";
import { ensureFulfillment, exportReadyOrders, updateFulfillment } from "@/server/fulfillment";
import { getViewer } from "@/server/session";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function admin() {
  const v = await getViewer();
  if (!v?.isAdmin) throw new Error("Forbidden");
  return v.email;
}

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Invalid input") : e instanceof Error ? e.message : "Something went wrong" });

// ─── Artworks ───────────────────────────────────────────────────────────────────

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg" } as const;

export async function prepareArtworkUpload(contentType: string): Promise<ActionResult<{ key: string; url: string; method: "PUT"; headers: Record<string, string> }>> {
  try {
    await admin();
    const type = z.enum(Object.keys(IMAGE_TYPES) as [keyof typeof IMAGE_TYPES]).parse(contentType);
    // Random, unguessable key: knowing day N's key reveals nothing about day N+1.
    const key = `art/${randomUUID()}.${IMAGE_TYPES[type]}`;
    const upload = await storage().createUpload(key, type);
    return { ok: true, data: { key, ...upload } };
  } catch (e) {
    return fail(e);
  }
}

const artworkSchema = z.object({
  day: z.coerce.number().int().min(1).max(24),
  title: z.string().trim().min(1, "Title is required").max(200),
  artist: z.string().trim().min(1, "Artist is required").max(200),
  medium: z.string().trim().max(200).default(""),
  dimensions: z.string().trim().max(200).default(""),
  year: z.coerce.number().int().min(1000).max(3000).nullable().catch(null),
  description: z.string().trim().max(1000).default(""),
  story: z.string().trim().max(5000).default(""),
  printSku: z.string().trim().min(1, "Print SKU is required").max(80),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().catch(null),
  published: z.boolean(),
  image: z.object({ key: z.string().regex(/^art\/[0-9a-f-]{36}\.(jpg|png|webp|avif|svg)$/), type: z.string(), width: z.number().int().positive(), height: z.number().int().positive() }).nullable(),
});

export async function saveArtwork(input: z.input<typeof artworkSchema>): Promise<ActionResult> {
  try {
    const actor = await admin();
    const d = artworkSchema.parse(input);
    const [existing] = await db.select().from(artwork).where(eq(artwork.day, d.day));
    if (d.published && !d.image && !existing?.imageKey) return { ok: false, error: "Add an image before publishing." };
    const values = {
      title: d.title,
      artist: d.artist,
      medium: d.medium,
      dimensions: d.dimensions,
      year: d.year,
      description: d.description,
      story: d.story,
      printSku: d.printSku,
      accent: d.accent,
      published: d.published,
      updatedAt: new Date(),
      ...(d.image ? { imageKey: d.image.key, imageType: d.image.type, width: d.image.width, height: d.image.height } : {}),
    };
    if (existing) await db.update(artwork).set(values).where(eq(artwork.id, existing.id));
    else await db.insert(artwork).values({ day: d.day, ...values });
    if (d.image && existing?.imageKey && existing.imageKey !== d.image.key) await storage().remove(existing.imageKey).catch(() => {});
    await audit(actor, "artwork.save", `day ${d.day}`, { published: d.published, newImage: Boolean(d.image) });
    revalidatePath("/admin/artworks");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ─── Editions ───────────────────────────────────────────────────────────────────

export async function assignEditionNumber(entitlementId: string, number: number): Promise<ActionResult> {
  try {
    const actor = await admin();
    const id = z.string().uuid().parse(entitlementId);
    const n = z.number().int().min(1).max(env.editionSize()).parse(number);
    const res = await db.transaction((tx) => assignSpecificEdition(tx, id, n));
    if (!res.ok) return res;
    await audit(actor, "edition.assign", id, { number: n });
    revalidatePath("/admin/editions");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function releaseRetiredEdition(number: number): Promise<ActionResult> {
  try {
    const actor = await admin();
    const n = z.number().int().min(1).parse(number);
    const ok = await db.transaction((tx) => releaseEdition(tx, n));
    if (!ok) return { ok: false, error: `No. ${n} is not retired.` };
    await audit(actor, "edition.release", String(n));
    revalidatePath("/admin/editions");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** A sold-out entitlement after a number was released: try to give it a number again. */
export async function retryActivation(entitlementId: string): Promise<ActionResult> {
  try {
    const actor = await admin();
    const id = z.string().uuid().parse(entitlementId);
    const result = await db.transaction(async (tx) => {
      const [ent] = await tx.select().from(entitlement).where(and(eq(entitlement.id, id), eq(entitlement.status, "needs_review"), eq(entitlement.reviewReason, "sold_out"))).for("update");
      if (!ent) return "Only sold-out entitlements can be retried.";
      await tx.update(entitlement).set({ status: "active", reviewReason: null }).where(eq(entitlement.id, id));
      const n = await claimEdition(tx, id);
      if (n == null) throw new Error("Still no edition number available. Release a retired number first.");
      const [order] = await tx.select().from(shopOrder).where(eq(shopOrder.id, ent.orderId));
      await ensureFulfillment(tx, id, order?.shippingAddress ?? null);
      return null;
    });
    if (result) return { ok: false, error: result };
    await audit(actor, "entitlement.retry", id);
    revalidatePath("/admin/editions");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ─── Fulfillment ────────────────────────────────────────────────────────────────

export async function exportOrders(): Promise<ActionResult<{ filename: string; csv: string; count: number } | null>> {
  try {
    const actor = await admin();
    const res = await exportReadyOrders(actor);
    revalidatePath("/admin/fulfillment");
    return { ok: true, data: res ? { filename: res.filename, csv: res.csv, count: res.count } : null };
  } catch (e) {
    return fail(e);
  }
}

const fulfillmentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FULFILLMENT_STATUS).optional(),
  carrier: z.enum(CARRIERS).optional(),
  trackingNumber: z.string().trim().max(60).regex(/^[A-Za-z0-9 -]*$/, "Tracking numbers use letters and digits only").optional(),
  note: z.string().trim().max(500).optional(),
});

export async function saveFulfillment(input: z.input<typeof fulfillmentSchema>): Promise<ActionResult> {
  try {
    const actor = await admin();
    const d = fulfillmentSchema.parse(input);
    const res = await updateFulfillment(d.id, actor, { status: d.status, carrier: d.carrier, trackingNumber: d.trackingNumber || undefined, note: d.note || undefined });
    if (!res.ok) return res;
    revalidatePath("/admin/fulfillment");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ─── Demo: simulate Shopify (real signed webhooks to our own endpoint) ─────────

async function sendSignedWebhook(topic: string, payload: unknown, webhookId = randomUUID()) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${env.appUrl()}/api/webhooks/shopify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Hmac-Sha256": shopifyHmac(body, env.shopify.webhookSecret()),
      "X-Shopify-Webhook-Id": webhookId,
      "X-Shopify-Shop-Domain": env.shopify.storeDomain() || "demo-store.myshopify.com",
    },
    body,
    cache: "no-store",
  });
  return `${res.status} ${await res.text()}`;
}

const simulateSchema = z.object({
  kind: z.enum(["purchase", "pending", "pay", "refund", "cancel", "fail", "duplicate", "forged"]),
  orderName: z.string().max(20).optional(),
});

export async function simulateShopify(input: z.input<typeof simulateSchema>): Promise<ActionResult<string>> {
  try {
    if (!env.demoMode()) return { ok: false, error: "Demo mode is off" };
    const actor = await admin();
    const d = simulateSchema.parse(input);
    const variantId = env.shopify.collectionVariantIds()[0] ?? "demo-variant-1";

    if (d.kind === "purchase" || d.kind === "pending") {
      const [{ m } = { m: null }] = await db.select({ m: max(shopOrder.shopifyOrderId) }).from(shopOrder);
      const orderId = String(Math.max(5000, Number(m ?? 0)) + 1);
      const count = Number(orderId) - 5000;
      const base = extraPersonas(60)[count % 60]!;
      const p = { ...base, customerId: `9${orderId}`, email: `collector.${orderId}@example.com` };
      const name = `#${1001 + count}`;
      const status = d.kind === "purchase" ? "paid" : "pending";
      const r = await sendSignedWebhook(d.kind === "purchase" ? "orders/paid" : "orders/create", demoOrderPayload(p, { orderId, name, financialStatus: status, variantId }));
      await audit(actor, "demo.simulate", name, { kind: d.kind });
      return { ok: true, data: `${name} (${p.firstName} ${p.lastName}, ${status}) → ${r}` };
    }

    const name = z.string().min(2, "Pick an order").parse(d.orderName);
    const [order] = await db.select().from(shopOrder).where(eq(shopOrder.name, name));
    if (!order) return { ok: false, error: `Order ${name} not found` };
    const persona = DEMO_PERSONAS.find((p) => p.email === order.email) ?? { key: "x", customerId: "0", email: order.email, firstName: "Demo", lastName: "Collector", address1: "1 Main St", city: "New York", province: "NY", zip: "10001" };
    const payload = (status: string, cancelledAt?: string) => ({
      ...demoOrderPayload(persona, { orderId: order.shopifyOrderId, name, financialStatus: status, cancelledAt, variantId }),
      email: order.email,
    });

    let r: string;
    switch (d.kind) {
      case "pay":
        r = await sendSignedWebhook("orders/paid", payload("paid"));
        break;
      case "refund":
        r = await sendSignedWebhook("refunds/create", demoRefundPayload({ refundId: String(Date.now()), orderId: order.shopifyOrderId, amount: (order.totalCents / 100).toFixed(2) }));
        break;
      case "cancel":
        r = await sendSignedWebhook("orders/cancelled", payload(order.financialStatus, new Date().toISOString()));
        break;
      case "fail":
        r = await sendSignedWebhook("orders/updated", payload("voided"));
        break;
      case "duplicate": {
        const id = randomUUID();
        const first = await sendSignedWebhook("orders/paid", payload("paid"), id);
        const second = await sendSignedWebhook("orders/paid", payload("paid"), id);
        r = `first: ${first} · replay: ${second}`;
        break;
      }
      case "forged": {
        const body = JSON.stringify(payload("paid"));
        const res = await fetch(`${env.appUrl()}/api/webhooks/shopify`, { method: "POST", headers: { "X-Shopify-Topic": "orders/paid", "X-Shopify-Hmac-Sha256": "forged==", "X-Shopify-Webhook-Id": randomUUID() }, body });
        r = `${res.status} ${await res.text()}`;
        break;
      }
      default:
        r = "unknown";
    }
    await audit(actor, "demo.simulate", name, { kind: d.kind });
    revalidatePath("/admin", "layout");
    return { ok: true, data: `${d.kind} ${name} → ${r}` };
  } catch (e) {
    return fail(e);
  }
}
