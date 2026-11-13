import { desc, eq } from "drizzle-orm";
import { Check, ExternalLink } from "lucide-react";
import { db } from "@/db/client";
import { fulfillmentEvent, fulfillmentOrder } from "@/db/schema";
import { FadeIn } from "@/components/FadeIn";
import { GoldRule } from "@/components/Monogram";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { DAYS, formatNy, isUnlocked, unlockAt } from "@/lib/unlock";
import { getCollection } from "@/server/artworks";
import { now } from "@/server/clock";
import { requireCollector } from "@/server/session";

export const metadata = { title: "Your prints" };

const STEPS = [
  { key: "confirmed", label: "Order confirmed", text: "Your edition is reserved." },
  { key: "studio", label: "In the studio", text: "Printing, inspection and hand-signing." },
  { key: "shipped", label: "Shipped", text: "Insured, signature required." },
  { key: "delivered", label: "Delivered", text: "Welcome home." },
] as const;

const stepIndex = (s: string) => ({ on_hold: 0, ready: 0, submitted: 1, in_production: 1, shipped: 2, delivered: 3, cancelled: 0 })[s] ?? 0;
const fmt = (d: Date | null) => (d ? formatNy(d, { dateStyle: "medium" }) : null);

export default async function ShippingPage() {
  const viewer = await requireCollector();
  const t = await now();
  const year = env.adventYear();
  const [fo] = await db.select().from(fulfillmentOrder).where(eq(fulfillmentOrder.entitlementId, viewer.access.entitlementId));
  const events = fo ? await db.select().from(fulfillmentEvent).where(eq(fulfillmentEvent.fulfillmentOrderId, fo.id)).orderBy(desc(fulfillmentEvent.createdAt)).limit(1) : [];
  const revealed = new Map((await getCollection(t)).map((w) => [w.day, w.title]));
  const current = fo ? stepIndex(fo.status) : 0;
  const dates = [fo?.createdAt ?? null, fo?.submittedAt ?? null, fo?.shippedAt ?? null, fo?.deliveredAt ?? null];

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <FadeIn className="text-center">
        <p className="eyebrow">Physical collection</p>
        <h1 className="mt-5 font-display text-4xl font-light sm:text-6xl">Your 24 prints</h1>
        <GoldRule className="my-8" />
        <p className="mx-auto max-w-lg text-sm text-muted">
          Your purchase includes the complete set: all twenty-four works as museum-grade prints, signed and numbered to your edition, shipped together in an archival portfolio.
        </p>
      </FadeIn>

      {!fo ? (
        <p className="mt-14 text-center text-sm text-muted">Your print order is being created. Please check back shortly.</p>
      ) : (
        <FadeIn delay={0.2} className="mt-14 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <section aria-label="Status" className="rounded-[4px] border hairline bg-ink-900/50 p-6 sm:p-8">
            {fo.status === "on_hold" && (
              <p className="mb-6 rounded border border-gold/30 bg-gold/5 p-4 text-sm text-parchment">
                We&apos;re confirming a detail of your order before it goes to the studio. We&apos;ll email you if we need anything.
              </p>
            )}
            {fo.status === "cancelled" && <p className="mb-6 text-sm text-garnet">This print order was cancelled.</p>}
            <ol className="relative space-y-8">
              <span aria-hidden className="absolute top-2 bottom-2 left-[11px] w-px bg-ink-700" />
              {STEPS.map((s, i) => {
                const done = i < current || (i === current && fo.status !== "on_hold" && fo.status !== "ready" && fo.status !== "cancelled") || (i === 0 && fo.status !== "cancelled");
                const active = i === current && fo.status !== "cancelled";
                return (
                  <li key={s.key} className="relative flex gap-5">
                    <span className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border ${done ? "border-gold bg-gold text-ink-950" : active ? "border-gold bg-ink-900" : "border-ink-700 bg-ink-900"}`}>
                      {done ? <Check className="size-3.5" strokeWidth={2} /> : active ? <span className="size-1.5 rounded-full bg-gold" /> : null}
                    </span>
                    <div>
                      <p className={`font-display text-xl ${done || active ? "text-ivory" : "text-faint"}`}>{s.label}</p>
                      <p className="text-xs text-muted">
                        {s.text}
                        {dates[i] && done ? ` · ${fmt(dates[i])}` : ""}
                      </p>
                      {s.key === "shipped" && fo.trackingNumber && (
                        <p className="mt-3 text-sm">
                          <span className="text-muted">{fo.carrier} </span>
                          <span className="font-mono text-parchment">{fo.trackingNumber}</span>
                          {fo.trackingUrl && (
                            <a href={fo.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-1 text-gold hover:text-gold-bright">
                              Track <ExternalLink className="size-3" />
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {events[0] && <p className="mt-8 border-t hairline pt-4 text-xs text-faint">Last update {formatNy(events[0].createdAt)}</p>}
          </section>

          <aside className="space-y-8">
            <section>
              <h2 className="eyebrow">Shipping to</h2>
              {fo.shipTo ? (
                <address className="mt-3 font-display text-lg not-italic leading-snug text-parchment">
                  {fo.shipTo.name}
                  <br />
                  {fo.shipTo.address1}
                  {fo.shipTo.address2 && (
                    <>
                      <br />
                      {fo.shipTo.address2}
                    </>
                  )}
                  <br />
                  {fo.shipTo.city}, {fo.shipTo.province} {fo.shipTo.zip}
                  <br />
                  {fo.shipTo.country}
                </address>
              ) : (
                <p className="mt-3 text-sm text-muted">We still need your shipping address. Please reply to your order email.</p>
              )}
              <p className="mt-3 text-xs text-faint">
                Need a change? Email <a href={`mailto:${BRAND.supportEmail}`} className="text-gold">{BRAND.supportEmail}</a> before your order enters the studio.
              </p>
            </section>
            <section>
              <h2 className="eyebrow">Contents · {fo.printCount} prints</h2>
              <ol className="mt-3 grid grid-cols-1 gap-y-1.5 text-sm">
                {Array.from({ length: DAYS }, (_, i) => i + 1).map((d) => (
                  <li key={d} className="flex gap-3 border-b border-white/[0.04] pb-1.5">
                    <span className="w-6 text-right font-display text-gold">{d}</span>
                    {/* Titles appear only once revealed: the list never spoils a future door. */}
                    {revealed.has(d) && isUnlocked(year, d, t) ? (
                      <span className="text-parchment">{revealed.get(d)}</span>
                    ) : (
                      <span className="italic text-faint">Revealed {formatNy(unlockAt(year, d), { month: "short", day: "numeric" })}</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </FadeIn>
      )}
    </main>
  );
}
