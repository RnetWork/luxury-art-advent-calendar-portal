import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { artwork } from "@/db/schema";
import { Badge } from "@/components/admin/AdminNav";
import { env } from "@/lib/env";
import { formatNy, isUnlocked, unlockAt } from "@/lib/unlock";
import { now } from "@/server/clock";

export default async function AdminArtworks() {
  const t = await now();
  const year = env.adventYear();
  const arts = await db.select().from(artwork).orderBy(asc(artwork.day));
  const byDay = new Map(arts.map((a) => [a.day, a]));
  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Artworks & schedule</p>
        <h1 className="mt-2 font-display text-4xl font-light">24 doors</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Each day unlocks at midnight New York time. Collectors see a door&apos;s artwork only once it is both <em>published</em> and unlocked. Images live in private storage.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => {
          const a = byDay.get(day);
          const live = isUnlocked(year, day, t);
          return (
            <li key={day}>
              <Link href={`/admin/artworks/${day}`} className="group block overflow-hidden rounded-lg border hairline bg-ink-900/60 transition-colors hover:border-gold/60">
                <div className="relative aspect-[4/5] bg-ink-850">
                  {a?.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin preview through the guarded route
                    <img src={`/api/artworks/${a.id}/image?v=${a.updatedAt.getTime()}`} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-faint">No image</div>
                  )}
                  <span className="absolute top-2 left-2 rounded-full bg-ink-950/80 px-2 py-0.5 font-display text-sm text-gold-bright">{day}</span>
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="truncate font-display text-base text-ivory">{a?.title ?? "Untitled"}</p>
                  <p className="text-[0.68rem] text-muted">{formatNy(unlockAt(year, day), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET</p>
                  <div className="flex flex-wrap gap-1">
                    {a?.published ? <Badge tone="good">Published</Badge> : <Badge tone="warn">Draft</Badge>}
                    {live && <Badge tone="gold">Live</Badge>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
