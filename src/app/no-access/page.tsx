import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entitlement, shopOrder } from "@/db/schema";
import { GoldRule, Monogram } from "@/components/Monogram";
import { BRAND } from "@/lib/brand";
import { getViewer } from "@/server/session";

export const metadata = { title: "Access" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  pending: { title: "Your payment is being confirmed", body: "As soon as Shopify confirms your payment, your edition number is reserved and the calendar opens. This page updates automatically when you return." },
  needs_review: { title: "We're preparing your edition", body: "Your order needs a quick personal review by our team. We'll be in touch by email shortly." },
  revoked: { title: "This collection is no longer active", body: "This order was cancelled or refunded, so the private calendar is closed for this account." },
  none: { title: "No collector edition on this account", body: "We couldn't find a collection purchase for this email. If you bought with a different email, sign out and use that one." },
};

export default async function NoAccess() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.access) redirect("/calendar");
  let state = "none";
  if (viewer.collector) {
    const [latest] = await db
      .select({ status: entitlement.status, revokedReason: entitlement.revokedReason })
      .from(entitlement)
      .innerJoin(shopOrder, eq(shopOrder.id, entitlement.orderId))
      .where(and(eq(entitlement.collectorId, viewer.collector.id)))
      .orderBy(desc(entitlement.createdAt))
      .limit(1);
    if (latest) state = latest.status;
  }
  const m = MESSAGES[state] ?? MESSAGES.none!;
  return (
    <main className="ambient flex min-h-dvh items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <Monogram size={64} className="mx-auto" />
        <h1 className="mt-8 font-display text-4xl font-light">{m.title}</h1>
        <GoldRule className="my-8" />
        <p className="text-sm leading-relaxed text-muted">{m.body}</p>
        <p className="mt-6 text-xs text-faint">
          Questions? <a className="text-gold underline-offset-4 hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        </p>
        <div className="mt-10 flex justify-center gap-3">
          {viewer.isAdmin && <Link href="/admin" className="btn-ghost">Admin</Link>}
          <form action="/auth/logout" method="post">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </div>
    </main>
  );
}
