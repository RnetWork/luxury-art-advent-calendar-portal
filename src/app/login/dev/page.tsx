import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Monogram } from "@/components/Monogram";
import { DEMO_PERSONAS } from "@/lib/demo-orders";
import { env } from "@/lib/env";
import { demoLogin } from "@/server/actions/demo";

export const metadata = { title: "Demo sign-in" };

const NOTES: Record<string, string> = {
  eleanor: "Paid collector · Edition 1",
  james: "Paid collector · Edition 2",
  sofia: "Paid collector · Edition 3",
  daniel: "Payment pending · no access yet",
  margaret: "Refunded · access revoked",
};

export default async function DevLogin() {
  await connection(); // decide demo mode per request, never at build time
  if (!env.demoMode()) notFound();
  return (
    <main className="ambient flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Monogram size={56} />
          <p className="eyebrow mt-6">Demo mode</p>
          <h1 className="mt-3 font-display text-4xl font-light">Choose a persona</h1>
          <p className="mt-3 text-sm text-muted">In production this step is Shopify&apos;s customer sign-in (one-time code by email).</p>
        </div>
        <form action={demoLogin} className="space-y-2">
          {DEMO_PERSONAS.map((p) => (
            <button
              key={p.key}
              name="persona"
              value={p.key}
              className="group flex w-full items-center justify-between rounded-2xl border hairline bg-ink-900/60 px-5 py-4 text-left transition-colors hover:border-gold/60 hover:bg-ink-850"
            >
              <span>
                <span className="block font-display text-xl text-ivory">
                  {p.firstName} {p.lastName}
                </span>
                <span className="block text-xs text-muted">{NOTES[p.key]}</span>
              </span>
              <span className="text-gold opacity-0 transition-opacity group-hover:opacity-100">→</span>
            </button>
          ))}
          <button name="persona" value="admin" className="flex w-full items-center justify-between rounded-2xl border border-dashed hairline px-5 py-4 text-left hover:border-gold/60">
            <span>
              <span className="block font-display text-xl text-ivory">The Curator</span>
              <span className="block text-xs text-muted">Admin · artworks, editions, fulfillment</span>
            </span>
          </button>
        </form>
      </div>
    </main>
  );
}
