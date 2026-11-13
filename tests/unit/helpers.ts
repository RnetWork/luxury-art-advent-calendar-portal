import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { artwork } from "@/db/schema";
import { ensureEditionPool } from "@/server/editions";
import { demoOrderPayload, type DemoPersona } from "@/lib/demo-orders";

export async function resetDb(editionSize = 100) {
  await db.execute(sql`truncate table audit_log, webhook_event, fulfillment_event, fulfillment_order, export_batch, reveal_view, edition, entitlement, shop_order, session, collector, artwork restart identity cascade`);
  await db.transaction((tx) => ensureEditionPool(tx, editionSize));
}

export async function seedArtworks() {
  await db.insert(artwork).values(Array.from({ length: 24 }, (_, i) => ({ day: i + 1, title: `Work ${i + 1}`, artist: "Test", printSku: `T-${i + 1}`, imageKey: `demo/x${i + 1}.svg`, published: true })));
}

let n = 0;
export function persona(over: Partial<DemoPersona> = {}): DemoPersona {
  n++;
  return { key: `p${n}`, customerId: String(10_000 + n), email: `p${n}@example.com`, firstName: "Test", lastName: `Person${n}`, address1: "1 Main St", city: "New York", province: "NY", zip: "10001", ...over };
}

let orderSeq = 0;
export function order(p: DemoPersona, financialStatus = "paid", extra: Partial<Parameters<typeof demoOrderPayload>[1]> = {}) {
  orderSeq++;
  return demoOrderPayload(p, { orderId: String(700_000 + orderSeq), name: `#T${orderSeq}`, financialStatus, variantId: "demo-variant-1", ...extra });
}
