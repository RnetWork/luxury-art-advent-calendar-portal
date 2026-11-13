import Link from "next/link";
import { DoorGrid } from "@/components/calendar/DoorGrid";
import { Countdown } from "@/components/Countdown";
import { FadeIn } from "@/components/FadeIn";
import { GoldRule } from "@/components/Monogram";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { roman } from "@/lib/format";
import { ADVENT_TIME_ZONE, DAYS, nextUnlock, unlockedCount } from "@/lib/unlock";
import { getDoors } from "@/server/artworks";
import { now } from "@/server/clock";
import { requireCollector } from "@/server/session";

export const metadata = { title: "Calendar" };

function greeting(d: Date) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: ADVENT_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(d));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function CalendarPage() {
  const viewer = await requireCollector();
  const t = await now();
  const year = env.adventYear();
  const doors = await getDoors(viewer.collector.id, t);
  const open = unlockedCount(year, t);
  const next = nextUnlock(year, t);
  const today = open > 0 && open <= DAYS ? doors[open - 1] : null;
  const todayUnopened = today?.state === "open" && !today.opened;

  return (
    <main className="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <FadeIn className="text-center">
        <p className="eyebrow">December {year} · {BRAND.collection}</p>
        <h1 className="mt-5 font-display text-4xl font-light sm:text-6xl">
          {greeting(t)}, <span className="italic text-gold-foil">{viewer.collector.firstName ?? "Collector"}</span>
        </h1>
        <GoldRule className="my-8" />
        {open === 0 && next ? (
          <div>
            <p className="mb-6 text-sm text-muted">The first door opens at midnight on December 1, New York time.</p>
            <Countdown targetIso={next.at.toISOString()} serverNowIso={t.toISOString()} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <p className="text-sm text-muted">
              {open >= DAYS ? "All twenty-four works are revealed. Your collection is complete." : `${open} of ${DAYS} works revealed`}
            </p>
            {todayUnopened && (
              <Link href={`/reveal/${open}`} className="btn-gold">
                Open today&apos;s door · {roman(open)}
              </Link>
            )}
            {next && (
              <p className="text-xs text-faint">
                Door {next.day} opens in <NextIn at={next.at} now={t} />
              </p>
            )}
          </div>
        )}
      </FadeIn>
      <FadeIn delay={0.3} className="mt-14">
        <DoorGrid doors={doors} today={open} />
      </FadeIn>
    </main>
  );
}

function NextIn({ at, now }: { at: Date; now: Date }) {
  const mins = Math.max(1, Math.round((at.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return <>{h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`} (midnight ET)</>;
}
