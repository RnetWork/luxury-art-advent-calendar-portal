import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entitlement, shopOrder } from "@/db/schema";
import { Monogram } from "@/components/Monogram";
import { PrintButton } from "@/components/PrintButton";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { requireCollector } from "@/server/session";

export const metadata = { title: "Certificate" };

export default async function CertificatePage() {
  const viewer = await requireCollector();
  const [row] = await db
    .select({ ent: entitlement, order: shopOrder })
    .from(entitlement)
    .innerJoin(shopOrder, eq(shopOrder.id, entitlement.orderId))
    .where(eq(entitlement.id, viewer.access.entitlementId));
  const size = env.editionSize();
  const n = viewer.access.editionNumber;
  const name = [viewer.collector.firstName, viewer.collector.lastName].filter(Boolean).join(" ") || viewer.collector.email;
  const acquired = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(row!.ent.editionAssignedAt ?? row!.ent.createdAt);
  const certId = `${env.adventYear()}-${String(n ?? 0).padStart(3, "0")}-${row!.ent.id.slice(0, 8).toUpperCase()}`;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="no-print mb-8 flex items-center justify-between">
        <p className="eyebrow">Certificate of authenticity</p>
        <PrintButton />
      </div>

      {/* Light, paper-like sheet; prints on Letter landscape. */}
      <article className="print-sheet relative mx-auto aspect-[11/8.5] w-full overflow-hidden bg-paper text-paper-ink shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]" aria-label="Certificate">
        <div className="absolute inset-[3%] border border-paper-line" />
        <div className="absolute inset-[4%] border border-paper-line/40" />
        <div className="relative flex h-full flex-col items-center justify-center px-[10%] text-center">
          <Monogram size={64} className="max-sm:hidden" />
          <p className="mt-[2%] text-[clamp(0.45rem,1.1vw,0.7rem)] uppercase tracking-[0.4em] text-gold-deep">{BRAND.house}</p>
          <h1 className="mt-[1.5%] font-display text-[clamp(1.4rem,4.6vw,3.2rem)] font-light leading-none">Certificate of Authenticity</h1>
          <p className="mt-[3%] font-display text-[clamp(0.75rem,1.9vw,1.25rem)] italic text-paper-muted">This certifies that</p>
          <p className="mt-[1%] font-display text-[clamp(1.2rem,4vw,2.8rem)] text-paper-ink">{name}</p>
          <p className="mt-[1.5%] max-w-[80%] font-display text-[clamp(0.75rem,1.9vw,1.25rem)] italic leading-snug text-paper-muted">
            is the owner of collector edition
          </p>
          <p className="mt-[1.5%] font-display text-[clamp(1.6rem,6vw,4rem)] font-light leading-none text-gold-deep">
            {n ? `No. ${String(n).padStart(String(size).length, "0")}` : "—"}
            <span className="text-[0.45em] text-paper-muted"> / {size}</span>
          </p>
          <p className="mt-[2%] max-w-[85%] text-[clamp(0.45rem,1.15vw,0.8rem)] leading-relaxed text-paper-muted">
            of <em className="font-display text-[1.15em]">{BRAND.collection}</em>, a limited collection of twenty-four original works issued in December {env.adventYear()},
            comprising the complete set of 24 archival pigment prints on cotton rag, each hand-signed and numbered to this edition.
          </p>
          <div className="mt-[4%] grid w-full grid-cols-3 items-end gap-[4%] text-[clamp(0.4rem,1vw,0.68rem)] uppercase tracking-[0.2em] text-gold-deep">
            <div>
              <div className="border-t border-paper-line pt-[6%]">Acquired {acquired}</div>
            </div>
            <div>
              <div className="font-display text-[2.4em] normal-case italic tracking-normal text-paper-ink">{BRAND.house}</div>
              <div className="border-t border-paper-line pt-[6%]">For the house</div>
            </div>
            <div>
              <div className="border-t border-paper-line pt-[6%]">Order {row!.order.name}</div>
            </div>
          </div>
          <p className="absolute bottom-[6%] text-[clamp(0.35rem,0.8vw,0.55rem)] tracking-[0.25em] text-gold-deep/80">CERTIFICATE {certId}</p>
        </div>
      </article>
      <p className="no-print mt-6 text-center text-xs text-faint">A signed paper certificate travels with your prints.</p>
    </main>
  );
}
