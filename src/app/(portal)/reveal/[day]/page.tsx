import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Reveal } from "@/components/reveal/Reveal";
import { Countdown } from "@/components/Countdown";
import { env } from "@/lib/env";
import { roman } from "@/lib/format";
import { DAYS, formatNy, unlockAt, unlockedCount } from "@/lib/unlock";
import { getUnlockedArtwork, markViewed } from "@/server/artworks";
import { now } from "@/server/clock";
import { requireCollector } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  return { title: `Day ${day}` };
}

export default async function RevealPage({ params, searchParams }: { params: Promise<{ day: string }>; searchParams: Promise<{ instant?: string }> }) {
  const viewer = await requireCollector();
  const day = Number((await params).day);
  if (!Number.isInteger(day) || day < 1 || day > DAYS) notFound();
  const t = await now();
  const year = env.adventYear();
  const art = await getUnlockedArtwork(day, t);
  const open = unlockedCount(year, t);

  if (!art) {
    // Locked (or not yet published): nothing about the artwork is sent.
    const at = unlockAt(year, day);
    const passed = t >= at;
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <Lock className="size-6 text-gold" strokeWidth={1} />
        <p className="eyebrow mt-6">Day {roman(day)}</p>
        <h1 className="mt-4 font-display text-4xl font-light">{passed ? "This work is being prepared" : "This door is still closed"}</h1>
        <p className="mt-4 text-sm text-muted">{passed ? "It will appear here shortly." : `It opens ${formatNy(at)} (New York time).`}</p>
        {!passed && (
          <div className="mt-10">
            <Countdown targetIso={at.toISOString()} serverNowIso={t.toISOString()} />
          </div>
        )}
        <Link href="/calendar" className="btn-ghost mt-12">
          Back to the calendar
        </Link>
      </main>
    );
  }

  await markViewed(viewer.collector.id, art.id);
  const instant = (await searchParams).instant === "1";
  return <Reveal artwork={art} prevDay={day > 1 ? day - 1 : null} nextDay={day < open ? day + 1 : null} instant={instant} editionSize={env.editionSize()} />;
}
