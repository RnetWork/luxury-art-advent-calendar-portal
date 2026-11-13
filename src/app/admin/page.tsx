import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { artwork, collector, edition, entitlement, fulfillmentOrder, shopOrder, webhookEvent } from "@/db/schema";
import { Badge, Stat } from "@/components/admin/AdminNav";
import { env } from "@/lib/env";
import { formatNy, unlockedCount } from "@/lib/unlock";
import { now } from "@/server/clock";

const REVIEW_TEXT: Record<string, string> = {
  second_order: "Second collection by the same collector — refund or arrange a gift in Shopify",
  sold_out: "Paid after all editions were taken — refund, or release a retired number and retry",
  partial_refund: "Partially refunded — access kept, check the order",
};

export default async function AdminOverview() {
  const t = await now();
  const year = env.adventYear();
  const [editions, ents, fulfil, published, failed, review, recent] = await Promise.all([
    db.select({ status: edition.status, n: count() }).from(edition).groupBy(edition.status),
    db.select({ status: entitlement.status, n: count() }).from(entitlement).groupBy(entitlement.status),
    db.select({ status: fulfillmentOrder.status, n: count() }).from(fulfillmentOrder).groupBy(fulfillmentOrder.status),
    db.select({ n: count() }).from(artwork).where(eq(artwork.published, true)),
    db.select({ n: count() }).from(webhookEvent).where(eq(webhookEvent.status, "failed")),
    db
      .select({ id: entitlement.id, status: entitlement.status, reason: entitlement.reviewReason, name: shopOrder.name, email: collector.email })
      .from(entitlement)
      .innerJoin(shopOrder, eq(shopOrder.id, entitlement.orderId))
      .innerJoin(collector, eq(collector.id, entitlement.collectorId))
      .where(sql`${entitlement.reviewReason} is not null`)
      .orderBy(desc(entitlement.createdAt))
      .limit(10),
    db.select().from(webhookEvent).orderBy(desc(webhookEvent.receivedAt)).limit(6),
  ]);
  const by = <T extends { status: string; n: number }>(rows: T[], s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  const size = env.editionSize();
  const sold = by(editions, "assigned");
  const holds = await db.select({ n: count() }).from(fulfillmentOrder).where(eq(fulfillmentOrder.status, "on_hold"));

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Overview</p>
        <h1 className="mt-2 font-display text-4xl font-light">Release {year}</h1>
        <p className="mt-1 text-sm text-muted">
          {unlockedCount(year, t)} of 24 doors open · server time {formatNy(t)} ET
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Editions sold" value={`${sold} / ${size}`} hint={`${by(editions, "available")} available · ${by(editions, "retired")} retired`} />
        <Stat label="Active collectors" value={by(ents, "active")} hint={`${by(ents, "pending")} payment pending · ${by(ents, "revoked")} revoked`} />
        <Stat label="Ready to print" value={by(fulfil, "ready")} hint={`${by(fulfil, "submitted") + by(fulfil, "in_production")} at the lab · ${by(fulfil, "shipped")} shipped`} />
        <Stat label="Artworks published" value={`${published[0]?.n ?? 0} / 24`} hint={failed[0]?.n ? `${failed[0].n} webhook failures` : "All webhooks processed"} />
      </section>

      <div className="h-2 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuenow={sold} aria-valuemax={size} aria-label="Editions sold">
        <div className="h-full rounded-full [background:var(--gold-gradient)]" style={{ width: `${(sold / size) * 100}%` }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border hairline bg-ink-900/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Needs attention</h2>
            {(holds[0]?.n ?? 0) > 0 && (
              <Link href="/admin/fulfillment?status=on_hold" className="text-xs text-gold">
                {holds[0]!.n} print orders on hold →
              </Link>
            )}
          </div>
          {review.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing to review. Every paid order has an edition and a print order.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {review.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-ivory">{r.name}</span>
                    <span className="text-muted">{r.email}</span>
                    <Badge tone={r.status === "active" ? "gold" : "warn"}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted">{REVIEW_TEXT[r.reason ?? ""] ?? r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border hairline bg-ink-900/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Latest Shopify events</h2>
            <Link href="/admin/events" className="text-xs text-gold">
              All events →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-white/5 text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate">
                  <span className="text-ivory">{e.topic}</span> <span className="text-muted">{(e.payload as { name?: string } | null)?.name ?? ""}</span>
                </span>
                <Badge tone={e.status === "processed" ? "good" : e.status === "failed" ? "bad" : "neutral"}>{e.status}</Badge>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-muted">No events yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
