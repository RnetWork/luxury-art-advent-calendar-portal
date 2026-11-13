import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { shopOrder } from "@/db/schema";
import { Simulator } from "@/components/admin/Simulator";
import { env } from "@/lib/env";
import { isDemoClockSet, now } from "@/server/clock";

export default async function DemoTools() {
  if (!env.demoMode()) notFound();
  const orders = await db.select({ name: shopOrder.name, email: shopOrder.email, status: shopOrder.financialStatus, cancelled: shopOrder.cancelledAt }).from(shopOrder).orderBy(desc(shopOrder.createdAt)).limit(40);
  const t = await now();
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Demo tools</p>
        <h1 className="mt-2 font-display text-4xl font-light">Simulate Shopify</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          These buttons send <strong className="text-parchment">real HMAC-signed webhooks</strong> to <code className="text-gold">/api/webhooks/shopify</code>, so they exercise exactly the production path: signature check, idempotency, editions, fulfillment, refunds. Not available in production.
        </p>
      </div>
      <Simulator
        year={env.adventYear()}
        nowIso={t.toISOString()}
        simulated={await isDemoClockSet()}
        orders={orders.map((o) => ({ name: o.name, label: `${o.name} · ${o.email} · ${o.cancelled ? "cancelled" : o.status}` }))}
      />
    </div>
  );
}
