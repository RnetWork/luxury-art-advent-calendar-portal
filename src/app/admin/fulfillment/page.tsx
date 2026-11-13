import Link from "next/link";
import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { collector, edition, entitlement, exportBatch, FULFILLMENT_STATUS, fulfillmentOrder, shopOrder, type FulfillmentStatus } from "@/db/schema";
import { ExportButton, FulfillmentRow } from "@/components/admin/Fulfillment";
import { env } from "@/lib/env";
import { allowedNext } from "@/server/fulfillment";

const LABEL: Record<FulfillmentStatus, string> = { on_hold: "On hold", ready: "Ready", submitted: "At the lab", in_production: "In production", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

export default async function AdminFulfillment({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const filter = FULFILLMENT_STATUS.includes(sp.status as FulfillmentStatus) ? (sp.status as FulfillmentStatus) : null;
  const [counts, rows, batches] = await Promise.all([
    db.select({ status: fulfillmentOrder.status, n: count() }).from(fulfillmentOrder).groupBy(fulfillmentOrder.status),
    db
      .select({ fo: fulfillmentOrder, c: collector, o: shopOrder, number: edition.number })
      .from(fulfillmentOrder)
      .innerJoin(entitlement, eq(entitlement.id, fulfillmentOrder.entitlementId))
      .innerJoin(collector, eq(collector.id, entitlement.collectorId))
      .innerJoin(shopOrder, eq(shopOrder.id, entitlement.orderId))
      .leftJoin(edition, eq(edition.entitlementId, entitlement.id))
      .where(filter ? eq(fulfillmentOrder.status, filter) : undefined)
      .orderBy(asc(edition.number), desc(fulfillmentOrder.createdAt)),
    db.select({ id: exportBatch.id, createdAt: exportBatch.createdAt, orderCount: exportBatch.orderCount, createdBy: exportBatch.createdBy }).from(exportBatch).orderBy(desc(exportBatch.createdAt)).limit(5),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Fulfillment · {env.fulfillment.labName()}</p>
          <h1 className="mt-2 font-display text-4xl font-light">Print orders</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            One order of 24 prints per collector, created automatically on payment (never twice). Export sends every <em>ready</em> order to the lab exactly once; then add tracking numbers here.
          </p>
        </div>
        <ExportButton ready={n("ready")} />
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter">
        <Link href="/admin/fulfillment" className={`rounded-full px-3 py-1.5 text-xs ${!filter ? "bg-gold/15 text-gold-bright" : "text-muted hover:text-ivory"}`}>
          All {counts.reduce((s, c) => s + c.n, 0)}
        </Link>
        {FULFILLMENT_STATUS.map((s) => (
          <Link key={s} href={`/admin/fulfillment?status=${s}`} className={`rounded-full px-3 py-1.5 text-xs ${filter === s ? "bg-gold/15 text-gold-bright" : "text-muted hover:text-ivory"}`}>
            {LABEL[s]} {n(s)}
          </Link>
        ))}
      </nav>

      <div className="space-y-2">
        {rows.length === 0 && <p className="rounded-xl border hairline p-6 text-sm text-muted">No print orders here.</p>}
        {rows.map(({ fo, c, o, number }) => (
          <FulfillmentRow
            key={fo.id}
            row={{
              id: fo.id,
              status: fo.status,
              statusLabel: LABEL[fo.status],
              next: allowedNext(fo.status).map((s) => ({ value: s, label: LABEL[s] })),
              edition: number,
              name: [c.firstName, c.lastName].filter(Boolean).join(" "),
              email: c.email,
              order: o.name,
              city: fo.shipTo ? `${fo.shipTo.city}, ${fo.shipTo.province ?? ""} ${fo.shipTo.countryCode ?? ""}` : null,
              holdReason: fo.holdReason,
              carrier: fo.carrier,
              trackingNumber: fo.trackingNumber,
              trackingUrl: fo.trackingUrl,
            }}
          />
        ))}
      </div>

      {batches.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">Export history</h2>
          <ul className="mt-3 divide-y divide-white/5 rounded-xl border hairline text-sm">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-3">
                <span className="text-muted">
                  {b.createdAt.toLocaleString("en-US", { timeZone: "America/New_York" })} · {b.orderCount} orders · {b.createdBy}
                </span>
                <a href={`/api/admin/export?batch=${b.id}`} className="text-xs text-gold hover:text-gold-bright">
                  Download CSV
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
