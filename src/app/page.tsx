import Link from "next/link";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/FadeIn";
import { GoldRule, Monogram } from "@/components/Monogram";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { getViewer } from "@/server/session";

const ERRORS: Record<string, string> = {
  login_expired: "Your sign-in link expired. Please try again.",
  login_failed: "We couldn't complete your sign-in. Please try again.",
  login_unavailable: "Sign-in is not available right now.",
};

export default async function Welcome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await getViewer();
  if (viewer?.access) redirect("/calendar");
  if (viewer?.isAdmin) redirect("/admin");
  if (viewer) redirect("/no-access");
  const { error } = await searchParams;

  return (
    <main className="ambient relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* slow light sweeping across the room */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background:conic-gradient(from_200deg_at_50%_120%,transparent_0deg,color-mix(in_oklab,var(--color-gold)_10%,transparent)_40deg,transparent_80deg)] motion-safe:animate-[spin_60s_linear_infinite]" />
      <div className="relative z-10 flex max-w-2xl flex-col items-center">
        <FadeIn>
          <Monogram size={88} />
        </FadeIn>
        <FadeIn delay={0.25}>
          <p className="eyebrow mt-10">{BRAND.house} · {BRAND.season}</p>
        </FadeIn>
        <FadeIn delay={0.45}>
          <h1 className="mt-6 font-display text-6xl font-light leading-[0.95] tracking-tight sm:text-8xl">
            <span className="text-gold-foil">{BRAND.collection}</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.65}>
          <p className="mt-6 font-display text-xl italic text-parchment sm:text-2xl">{BRAND.tagline}</p>
        </FadeIn>
        <FadeIn delay={0.85}>
          <GoldRule className="my-10" />
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
            Twenty-four original works, revealed one each morning from December 1 to 24. Limited to {env.editionSize()} numbered
            collector editions, each with the complete set of museum-grade prints.
          </p>
        </FadeIn>
        <FadeIn delay={1.05} className="mt-10 flex flex-col items-center gap-4">
          {error && ERRORS[error] && (
            <p role="alert" className="text-sm text-garnet">
              {ERRORS[error]}
            </p>
          )}
          <Link href="/auth/login" className="btn-gold">
            Enter the collection
          </Link>
          <p className="text-xs text-faint">Sign in with the email you used to purchase. We&apos;ll send you a one-time code.</p>
          {env.demoMode() && (
            <Link href="/login/dev" className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-faint underline-offset-4 hover:text-gold hover:underline">
              Demo personas
            </Link>
          )}
        </FadeIn>
      </div>
      <footer className="absolute bottom-6 text-[0.6rem] uppercase tracking-[0.3em] text-faint">
        Private collector portal · By invitation of purchase
      </footer>
    </main>
  );
}
