import { z } from "zod";
import type { ShippingAddress } from "@/db/schema";

/** What the app needs from a Shopify order, whichever API it came from. */
export type NormalizedOrder = {
  shopifyOrderId: string;
  name: string;
  email: string;
  customer: { id: string | null; firstName: string | null; lastName: string | null };
  financialStatus: string;
  cancelledAt: Date | null;
  totalCents: number;
  currency: string;
  lineItems: Array<{ variantId: string; quantity: number }>;
  shippingAddress: ShippingAddress | null;
};

/** "gid://shopify/ProductVariant/123" → "123"; plain ids pass through. */
export const shopifyId = (v: string | number | null | undefined): string | null => {
  if (v == null || v === "") return null;
  const s = String(v);
  return s.startsWith("gid://") ? (s.split("/").pop() ?? null) : s;
};

export const toCents = (amount: string | number | null | undefined) => Math.round(Number(amount ?? 0) * 100);

const money = z.union([z.string(), z.number()]).nullish();
const address = z
  .object({
    name: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    company: z.string().nullish(),
    address1: z.string().nullish(),
    address2: z.string().nullish(),
    city: z.string().nullish(),
    province: z.string().nullish(),
    zip: z.string().nullish(),
    country: z.string().nullish(),
    country_code: z.string().nullish(),
    phone: z.string().nullish(),
  })
  .nullish();

/** REST-shaped order JSON as sent by orders/* webhooks. Unknown fields are ignored. */
export const webhookOrderSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  email: z.string().nullish(),
  contact_email: z.string().nullish(),
  financial_status: z.string().nullish(),
  cancelled_at: z.string().nullish(),
  total_price: money,
  currency: z.string().nullish(),
  customer: z
    .object({ id: z.union([z.number(), z.string()]).nullish(), email: z.string().nullish(), first_name: z.string().nullish(), last_name: z.string().nullish() })
    .nullish(),
  line_items: z.array(z.object({ variant_id: z.union([z.number(), z.string()]).nullish(), quantity: z.number() })).default([]),
  shipping_address: address,
});

export function normalizeAddress(a: z.infer<typeof address>): ShippingAddress | null {
  if (!a?.address1 || !a.city || !a.zip) return null;
  return {
    name: a.name ?? [a.first_name, a.last_name].filter(Boolean).join(" "),
    company: a.company ?? null,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    province: a.province ?? null,
    zip: a.zip,
    country: a.country ?? a.country_code ?? "",
    countryCode: a.country_code ?? null,
    phone: a.phone ?? null,
  };
}

export function normalizeWebhookOrder(json: unknown): NormalizedOrder {
  const o = webhookOrderSchema.parse(json);
  const email = (o.email || o.contact_email || o.customer?.email || "").toLowerCase();
  return {
    shopifyOrderId: shopifyId(o.id)!,
    name: o.name,
    email,
    customer: { id: shopifyId(o.customer?.id), firstName: o.customer?.first_name ?? null, lastName: o.customer?.last_name ?? null },
    financialStatus: (o.financial_status ?? "pending").toLowerCase(),
    cancelledAt: o.cancelled_at ? new Date(o.cancelled_at) : null,
    totalCents: toCents(o.total_price),
    currency: o.currency ?? "USD",
    lineItems: o.line_items.map((li) => ({ variantId: shopifyId(li.variant_id) ?? "", quantity: li.quantity })),
    shippingAddress: normalizeAddress(o.shipping_address),
  };
}

export const webhookRefundSchema = z.object({
  id: z.union([z.number(), z.string()]),
  order_id: z.union([z.number(), z.string()]),
  transactions: z.array(z.object({ amount: money, kind: z.string().nullish(), status: z.string().nullish() })).default([]),
});

/** Cents actually refunded by a refunds/create payload (successful refund transactions). */
export function refundCents(json: unknown): { refundId: string; orderId: string; cents: number } {
  const r = webhookRefundSchema.parse(json);
  const cents = r.transactions.filter((t) => (t.kind ?? "refund") === "refund" && (t.status ?? "success") === "success").reduce((s, t) => s + toCents(t.amount), 0);
  return { refundId: shopifyId(r.id)!, orderId: shopifyId(r.order_id)!, cents };
}

/** Financial status rank: an older, lower-ranked event never downgrades a newer state. */
export function financialRank(status: string): number {
  switch (status) {
    case "paid":
    case "partially_refunded":
      return 2;
    case "refunded":
    case "voided":
    case "expired":
    case "failed":
      return 3;
    default:
      return 1; // pending, authorized, partially_paid, unknown
  }
}

export type OrderOutcome = "active" | "pending" | "revoked";

/** What access an order grants, given its state. */
export function orderOutcome(o: { financialStatus: string; cancelledAt: Date | null; totalCents: number; refundedCents: number }): { outcome: OrderOutcome; reason?: string } {
  if (o.cancelledAt) return { outcome: "revoked", reason: "order_cancelled" };
  if (o.financialStatus === "refunded" || (o.totalCents > 0 && o.refundedCents >= o.totalCents)) return { outcome: "revoked", reason: "refunded" };
  if (o.financialStatus === "voided") return { outcome: "revoked", reason: "payment_voided" };
  if (o.financialStatus === "failed" || o.financialStatus === "expired") return { outcome: "revoked", reason: "payment_failed" };
  if (o.financialStatus === "paid" || o.financialStatus === "partially_refunded") return { outcome: "active" };
  return { outcome: "pending" };
}
