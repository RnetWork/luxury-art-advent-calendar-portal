import { describe, expect, it } from "vitest";
import { shopifyHmac, sign, unsign, verifyShopifyHmac } from "@/lib/crypto";
import { toCsv } from "@/lib/csv";
import { demoOrderPayload } from "@/lib/demo-orders";
import { financialRank, normalizeWebhookOrder, orderOutcome, refundCents, shopifyId } from "@/lib/shopify-order";
import { trackingUrl } from "@/lib/tracking";
import { persona } from "./helpers";

describe("Shopify webhook HMAC", () => {
  const body = JSON.stringify({ id: 1, name: "#1001" });
  it("accepts a valid signature and rejects tampering", () => {
    const sig = shopifyHmac(body, "secret");
    expect(verifyShopifyHmac(body, sig, "secret")).toBe(true);
    expect(verifyShopifyHmac(body + " ", sig, "secret")).toBe(false);
    expect(verifyShopifyHmac(body, sig, "other")).toBe(false);
    expect(verifyShopifyHmac(body, null, "secret")).toBe(false);
    expect(verifyShopifyHmac(body, sig, "")).toBe(false);
  });
});

describe("signed cookies", () => {
  it("round-trips and rejects forgeries", () => {
    const s = sign("2026-12-24T05:00:00.000Z", "k".repeat(32));
    expect(unsign(s, "k".repeat(32))).toBe("2026-12-24T05:00:00.000Z");
    expect(unsign(s, "x".repeat(32))).toBeNull();
    expect(unsign(s.replace(/^./, "A"), "k".repeat(32))).toBeNull();
  });
});

describe("order normalization", () => {
  it("normalizes a REST webhook order", () => {
    const o = normalizeWebhookOrder(demoOrderPayload(persona({ email: "A@Example.com" }), { orderId: "123", name: "#1", financialStatus: "paid", variantId: "demo-variant-1" }));
    expect(o.shopifyOrderId).toBe("123");
    expect(o.email).toBe("a@example.com");
    expect(o.totalCents).toBe(499_900);
    expect(o.lineItems[0]).toEqual({ variantId: "demo-variant-1", quantity: 1 });
    expect(o.shippingAddress?.city).toBe("New York");
  });
  it("strips GIDs", () => {
    expect(shopifyId("gid://shopify/ProductVariant/42")).toBe("42");
    expect(shopifyId(42)).toBe("42");
  });
  it("sums successful refund transactions only", () => {
    const r = refundCents({ id: 9, order_id: 5, transactions: [{ amount: "100.00", kind: "refund", status: "success" }, { amount: "50.00", kind: "refund", status: "failure" }] });
    expect(r).toEqual({ refundId: "9", orderId: "5", cents: 10_000 });
  });
});

describe("order outcome", () => {
  const base = { financialStatus: "paid", cancelledAt: null, totalCents: 499_900, refundedCents: 0 };
  it.each([
    [{}, "active"],
    [{ financialStatus: "pending" }, "pending"],
    [{ financialStatus: "authorized" }, "pending"],
    [{ financialStatus: "refunded" }, "revoked"],
    [{ financialStatus: "voided" }, "revoked"],
    [{ refundedCents: 499_900, financialStatus: "partially_refunded" }, "revoked"],
    [{ refundedCents: 1_000, financialStatus: "partially_refunded" }, "active"],
    [{ cancelledAt: new Date() }, "revoked"],
  ])("%o → %s", (patch, expected) => {
    expect(orderOutcome({ ...base, ...patch }).outcome).toBe(expected);
  });
  it("never lets a stale pending event outrank paid", () => {
    expect(financialRank("pending")).toBeLessThan(financialRank("paid"));
    expect(financialRank("paid")).toBeLessThan(financialRank("refunded"));
  });
});

describe("CSV export", () => {
  it("escapes quotes/commas and neutralizes spreadsheet formulas", () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: "Smith, Jr." }], ["a", "b"]);
    expect(csv).toBe('a,b\r\n"\'=HYPERLINK(""x"")","Smith, Jr."\r\n');
  });
});

describe("tracking links", () => {
  it("builds carrier URLs and encodes numbers", () => {
    expect(trackingUrl("UPS", "1Z 999")).toBe("https://www.ups.com/track?tracknum=1Z%20999");
    expect(trackingUrl("Unknown", "1")).toBeNull();
  });
});
