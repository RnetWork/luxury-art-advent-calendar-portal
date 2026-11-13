import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { collector } from "@/db/schema";
import { ordersAdapter } from "@/adapters/orders";
import { env } from "@/lib/env";
import { audit } from "./audit";
import { syncOrder } from "./orders";
import { createSession } from "./session";

export type Identity = { shopifyCustomerId: string; email: string; firstName: string | null; lastName: string | null };

/**
 * After Shopify (or the demo login) has verified who this is: link the collector, recover a missed
 * purchase webhook via the Admin API if possible, and start a session. Access itself is decided per request.
 */
export async function completeLogin(id: Identity, method: "shopify" | "demo") {
  const email = id.email.toLowerCase();
  const isAdmin = env.adminEmails().includes(email);

  let [row] = await db.select().from(collector).where(eq(collector.shopifyCustomerId, id.shopifyCustomerId));
  if (!row) {
    [row] = await db.select().from(collector).where(sql`lower(${collector.email}) = ${email}`);
    if (row && row.shopifyCustomerId.startsWith("email:")) {
      await db.update(collector).set({ shopifyCustomerId: id.shopifyCustomerId }).where(eq(collector.id, row.id));
    }
  }

  // Missed webhook? Re-read this customer's orders from the Admin API (only when configured).
  const orders = ordersAdapter();
  if (orders.live && method === "shopify") {
    try {
      for (const orderId of await orders.listCustomerOrderIds(id.shopifyCustomerId)) {
        const o = await orders.fetchOrder(orderId);
        if (o) await syncOrder(o, { refundedCents: o.refundedCents });
      }
      if (!row) [row] = await db.select().from(collector).where(eq(collector.shopifyCustomerId, id.shopifyCustomerId));
    } catch (e) {
      console.error("[login] order recovery failed", e);
    }
  }

  await createSession({ collectorId: row?.id ?? null, email, isAdmin });
  await audit(email, "auth.login", row?.id ?? null, { method, isAdmin });
}
