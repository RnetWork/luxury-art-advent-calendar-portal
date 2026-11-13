import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artwork, revealView } from "@/db/schema";
import { env } from "@/lib/env";
import { DAYS, isUnlocked, unlockAt } from "@/lib/unlock";
import type { Viewer } from "./session";

export type PublicArtwork = {
  id: string;
  day: number;
  title: string;
  artist: string;
  medium: string;
  dimensions: string;
  year: number | null;
  description: string;
  story: string;
  accent: string | null;
  width: number | null;
  height: number | null;
  imageUrl: string | null;
};

const toPublic = (a: typeof artwork.$inferSelect): PublicArtwork => ({
  id: a.id,
  day: a.day,
  title: a.title,
  artist: a.artist,
  medium: a.medium,
  dimensions: a.dimensions,
  year: a.year,
  description: a.description,
  story: a.story,
  accent: a.accent,
  width: a.width,
  height: a.height,
  imageUrl: a.imageKey ? `/api/artworks/${a.id}/image?v=${a.updatedAt.getTime()}` : null,
});

/** A door. Locked doors carry NOTHING about the artwork behind them (no id, title, colour or file). */
export type Door =
  | { day: number; state: "locked"; unlockAt: string }
  | { day: number; state: "preparing"; unlockAt: string } // time passed, artwork not published yet
  | { day: number; state: "open"; opened: boolean; unlockAt: string; artwork: Pick<PublicArtwork, "id" | "title" | "artist" | "accent" | "imageUrl"> };

export async function getDoors(collectorId: string, now: Date): Promise<Door[]> {
  const year = env.adventYear();
  const [arts, views] = await Promise.all([
    db.select().from(artwork).where(eq(artwork.published, true)),
    db.select({ artworkId: revealView.artworkId }).from(revealView).where(eq(revealView.collectorId, collectorId)),
  ]);
  const byDay = new Map(arts.map((a) => [a.day, a]));
  const seen = new Set(views.map((v) => v.artworkId));
  return Array.from({ length: DAYS }, (_, i) => {
    const day = i + 1;
    const at = unlockAt(year, day).toISOString();
    if (!isUnlocked(year, day, now)) return { day, state: "locked", unlockAt: at } as const;
    const a = byDay.get(day);
    if (!a) return { day, state: "preparing", unlockAt: at } as const;
    const p = toPublic(a);
    return { day, state: "open", opened: seen.has(a.id), unlockAt: at, artwork: { id: p.id, title: p.title, artist: p.artist, accent: p.accent, imageUrl: p.imageUrl } } as const;
  });
}

/** The artwork for a day, or null if it is not unlocked (or not published) yet. */
export async function getUnlockedArtwork(day: number, now: Date): Promise<PublicArtwork | null> {
  if (!Number.isInteger(day) || day < 1 || day > DAYS) return null;
  if (!isUnlocked(env.adventYear(), day, now)) return null;
  const [a] = await db.select().from(artwork).where(and(eq(artwork.day, day), eq(artwork.published, true)));
  return a ? toPublic(a) : null;
}

export async function getCollection(now: Date): Promise<PublicArtwork[]> {
  const year = env.adventYear();
  const arts = await db.select().from(artwork).where(eq(artwork.published, true)).orderBy(asc(artwork.day));
  return arts.filter((a) => isUnlocked(year, a.day, now)).map(toPublic);
}

export async function markViewed(collectorId: string, artworkId: string) {
  await db.insert(revealView).values({ collectorId, artworkId }).onConflictDoNothing();
}

/** The single gate for artwork files. Admins see everything; collectors only unlocked, published art. */
export async function canViewArtworkFile(viewer: Viewer | null, artworkId: string, now: Date) {
  if (!viewer) return { ok: false as const, status: 401 };
  const [a] = await db.select().from(artwork).where(eq(artwork.id, artworkId));
  if (!a || !a.imageKey) return { ok: false as const, status: 404 };
  if (viewer.isAdmin) return { ok: true as const, artwork: a };
  if (!viewer.access) return { ok: false as const, status: 403 };
  // Same 404 for "not yet" and "doesn't exist": nothing to learn by probing ids.
  if (!a.published || !isUnlocked(env.adventYear(), a.day, now)) return { ok: false as const, status: 404 };
  return { ok: true as const, artwork: a };
}
