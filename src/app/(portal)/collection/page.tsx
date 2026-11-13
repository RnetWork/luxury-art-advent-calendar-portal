import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { GoldRule } from "@/components/Monogram";
import { env } from "@/lib/env";
import { roman } from "@/lib/format";
import { DAYS } from "@/lib/unlock";
import { getCollection } from "@/server/artworks";
import { now } from "@/server/clock";
import { requireCollector } from "@/server/session";

export const metadata = { title: "Your collection" };

export default async function CollectionPage() {
  await requireCollector();
  const works = await getCollection(await now());
  const byDay = new Map(works.map((w) => [w.day, w]));

  return (
    <main className="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <FadeIn className="text-center">
        <p className="eyebrow">Private gallery</p>
        <h1 className="mt-5 font-display text-4xl font-light sm:text-6xl">Your collection</h1>
        <GoldRule className="my-8" />
        <p className="text-sm text-muted">
          {works.length} of {DAYS} works revealed · each arrives as a signed, numbered print in your edition of {env.editionSize()}
        </p>
      </FadeIn>

      {works.length === 0 ? (
        <FadeIn delay={0.2} className="mt-16 text-center">
          <p className="font-display text-2xl italic text-parchment">Your walls are waiting.</p>
          <p className="mt-3 text-sm text-muted">The first work appears on December 1.</p>
          <Link href="/calendar" className="btn-ghost mt-8">
            View the calendar
          </Link>
        </FadeIn>
      ) : (
        <FadeIn delay={0.2} className="mt-14">
          <ol className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4 lg:gap-y-14">
            {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => {
              const w = byDay.get(day);
              return (
                <li key={day}>
                  {w ? (
                    <Link href={`/reveal/${day}?instant=1`} className="group block">
                      <div className="overflow-hidden p-[1px] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] transition-shadow duration-700 [background:var(--gold-gradient)] group-hover:shadow-[0_30px_80px_-20px_rgba(200,167,95,0.25)]">
                        <div className="aspect-[4/5] overflow-hidden bg-ink-900">
                          {/* eslint-disable-next-line @next/next/no-img-element -- guarded, private image route */}
                          <img src={w.imageUrl ?? ""} alt={`${w.title} by ${w.artist}`} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-[1.4s] ease-[var(--ease-gallery)] group-hover:scale-[1.04]" />
                        </div>
                      </div>
                      <p className="mt-4 text-[0.6rem] uppercase tracking-[0.28em] text-gold">{roman(day)}</p>
                      <p className="mt-1 font-display text-lg leading-snug text-ivory sm:text-xl">{w.title}</p>
                      <p className="text-xs text-muted">{w.artist}</p>
                    </Link>
                  ) : (
                    <div aria-label={`Day ${day}, not yet revealed`}>
                      <div className="flex aspect-[4/5] items-center justify-center border hairline bg-ink-900/40">
                        <span className="font-display text-3xl font-light text-ivory/15">{day}</span>
                      </div>
                      <p className="mt-4 text-[0.6rem] uppercase tracking-[0.28em] text-faint">{roman(day)}</p>
                      <p className="mt-1 font-display text-lg italic text-faint">Yet to be revealed</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </FadeIn>
      )}
    </main>
  );
}
