// Idempotent demo seed: edition pool, 24 generated artworks, demo collectors with orders that go through the
// real order pipeline (same code as verified Shopify webhooks). Only fills empty tables.
import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { db, sqlClient } from "./client";
import { artwork, shopOrder } from "./schema";
import { demoArtworkMeta, demoArtworkSvg } from "./demo-art";
import { storage } from "@/adapters/storage";
import { env } from "@/lib/env";
import { DEMO_PERSONAS, type DemoPersona, demoOrderPayload, demoRefundPayload, extraPersonas } from "@/lib/demo-orders";
import { ensureEditionPool } from "@/server/editions";
import { handleShopifyEvent } from "@/server/orders";

async function main() {
  await db.transaction((tx) => ensureEditionPool(tx, env.editionSize()));

  const [{ n: artCount }] = (await db.select({ n: count() }).from(artwork)) as [{ n: number }];
  if (artCount === 0) {
    const store = storage();
    for (let day = 1; day <= 24; day++) {
      const key = `demo/${randomUUID()}.svg`;
      await store.put(key, new TextEncoder().encode(demoArtworkSvg(day)), "image/svg+xml");
      const meta = demoArtworkMeta(day);
      await db.insert(artwork).values({ day, ...meta, year: env.adventYear(), imageKey: key, imageType: "image/svg+xml", printSku: `${env.fulfillment.skuPrefix()}-${env.adventYear()}-${String(day).padStart(2, "0")}`, published: true });
    }
    console.log("Seeded 24 artworks");
  }

  const [{ n: orderCount }] = (await db.select({ n: count() }).from(shopOrder)) as [{ n: number }];
  if (orderCount === 0) {
    const variantId = env.shopify.collectionVariantIds()[0] ?? "demo-variant-1";
    let n = 0;
    const next = () => ({ orderId: String(5000 + n), name: `#${1001 + n++}` });
    const persona = (k: string) => DEMO_PERSONAS.find((p) => p.key === k)!;
    const [eleanor, james, sofia, daniel, margaret] = ["eleanor", "james", "sofia", "daniel", "margaret"].map(persona) as [DemoPersona, DemoPersona, DemoPersona, DemoPersona, DemoPersona];

    for (const p of [eleanor, james, sofia]) await handleShopifyEvent("orders/paid", demoOrderPayload(p, { ...next(), financialStatus: "paid", variantId }));

    // Margaret paid, then was fully refunded → access revoked, edition retired, print order cancelled.
    const m = next();
    await handleShopifyEvent("orders/paid", demoOrderPayload(margaret, { ...m, financialStatus: "paid", variantId }));
    await handleShopifyEvent("refunds/create", demoRefundPayload({ refundId: "9001", orderId: m.orderId, amount: "4999.00" }));

    // Daniel's payment is still pending → no access yet.
    await handleShopifyEvent("orders/create", demoOrderPayload(daniel, { ...next(), financialStatus: "pending", variantId }));

    const extras = extraPersonas(18);
    for (const [i, p] of extras.entries()) {
      await handleShopifyEvent("orders/paid", demoOrderPayload(p, { ...next(), financialStatus: "paid", variantId, withAddress: i !== 5 }));
    }
    console.log(`Seeded ${n} demo orders`);
  }
}

await main();
await sqlClient.end();
