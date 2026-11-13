import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { collector, edition, entitlement, shopOrder } from "@/db/schema";
import { Badge } from "@/components/admin/AdminNav";
import { EditionActions, ReleaseButton } from "@/components/admin/EditionActions";

const TONE = { active: "good", pending: "neutral", revoked: "bad", needs_review: "warn" } as const;

export default async function AdminEditions() {
  const [pool, rows] = await Promise.all([
    db.select().from(edition).orderBy(asc(edition.number)),
    db
      .select({ ent: entitlement, c: collector, o: shopOrder })
      .from(entitlement)
      .innerJoin(collector, eq(collector.id, entitlement.collectorId))
      .innerJoin(shopOrder, eq(shopOrder.id, entitlement.orderId))
      .orderBy(asc(entitlement.editionNumber), desc(entitlement.createdAt)),
  ]);
  const retired = pool.filter((p) => p.status === "retired");

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Editions</p>
        <h1 className="mt-2 font-display text-4xl font-light">Numbered editions</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Numbers are assigned automatically and atomically when Shopify confirms payment (lowest free number first). Refunded numbers are retired, not re-issued, unless you release them.
        </p>
      </div>

      <section aria-label="Edition pool">
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 lg:grid-cols-20">
          {pool.map((p) => (
            <div
              key={p.number}
              title={`No. ${p.number}: ${p.status}`}
              className={`flex aspect-square items-center justify-center rounded text-[0.6rem] tabular-nums sm:text-xs ${
                p.status === "assigned" ? "bg-gold/80 text-ink-950" : p.status === "retired" ? "border border-garnet/50 text-garnet" : "border hairline text-faint"
              }`}
            >
              {p.number}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span className="flex items-center gap-2"><span className="size-3 rounded bg-gold/80" /> Assigned</span>
          <span className="flex items-center gap-2"><span className="size-3 rounded border hairline" /> Available</span>
          <span className="flex items-center gap-2"><span className="size-3 rounded border border-garnet/50" /> Retired (refund/cancel)</span>
        </div>
        {retired.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Release back to the pool:</span>
            {retired.map((r) => (
              <ReleaseButton key={r.number} number={r.number} />
            ))}
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border hairline">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b hairline text-[0.65rem] uppercase tracking-[0.18em] text-faint">
            <tr>
              <th className="p-3">Edition</th>
              <th className="p-3">Collector</th>
              <th className="p-3">Order</th>
              <th className="p-3">Status</th>
              <th className="p-3">Assign number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(({ ent, c, o }) => (
              <tr key={ent.id} className="align-middle">
                <td className="p-3 font-display text-xl text-gold-bright">{ent.editionNumber && ent.status === "active" ? `No. ${ent.editionNumber}` : <span className="text-faint">—</span>}</td>
                <td className="p-3">
                  <div className="text-ivory">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</div>
                  <div className="text-xs text-muted">{c.email}</div>
                </td>
                <td className="p-3 text-muted">
                  {o.name} · {o.financialStatus}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={TONE[ent.status]}>{ent.status.replace("_", " ")}</Badge>
                    {ent.reviewReason && <Badge tone="warn">{ent.reviewReason.replace("_", " ")}</Badge>}
                    {ent.revokedReason && <Badge>{ent.revokedReason.replace("_", " ")}</Badge>}
                  </div>
                </td>
                <td className="p-3">
                  <EditionActions entitlementId={ent.id} status={ent.status} reviewReason={ent.reviewReason} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
