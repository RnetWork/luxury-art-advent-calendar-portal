import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artwork } from "@/db/schema";
import { canViewArtworkFile, getDoors, getUnlockedArtwork } from "@/server/artworks";
import type { Viewer } from "@/server/session";
import { resetDb, seedArtworks } from "./helpers";

const DEC12 = new Date("2026-12-12T15:00:00Z");
const NOV30 = new Date("2026-11-30T20:00:00Z");
const collectorViewer = (active = true): Viewer => ({
  sessionId: "s",
  email: "c@example.com",
  isAdmin: false,
  collector: { id: "00000000-0000-0000-0000-000000000001", firstName: "C", lastName: null, email: "c@example.com" },
  access: active ? { entitlementId: "e", editionNumber: 1, status: "active" } : null,
});
const artFor = async (day: number) => (await db.select().from(artwork).where(eq(artwork.day, day)))[0]!;

beforeEach(async () => {
  await resetDb();
  await seedArtworks();
});

describe("future artwork is never exposed", () => {
  it("serves today's file but 404s tomorrow's", async () => {
    expect((await canViewArtworkFile(collectorViewer(), (await artFor(12)).id, DEC12)).ok).toBe(true);
    expect(await canViewArtworkFile(collectorViewer(), (await artFor(13)).id, DEC12)).toMatchObject({ ok: false, status: 404 });
    expect(await canViewArtworkFile(collectorViewer(), (await artFor(1)).id, NOV30)).toMatchObject({ ok: false, status: 404 });
  });

  it("requires a session and an active entitlement", async () => {
    const id = (await artFor(1)).id;
    expect(await canViewArtworkFile(null, id, DEC12)).toMatchObject({ status: 401 });
    expect(await canViewArtworkFile(collectorViewer(false), id, DEC12)).toMatchObject({ status: 403 });
  });

  it("hides unpublished art even after its unlock time; admins can preview everything", async () => {
    await db.update(artwork).set({ published: false }).where(eq(artwork.day, 5));
    const id = (await artFor(5)).id;
    expect((await canViewArtworkFile(collectorViewer(), id, DEC12)).ok).toBe(false);
    expect((await canViewArtworkFile({ ...collectorViewer(), isAdmin: true }, (await artFor(24)).id, NOV30)).ok).toBe(true);
  });

  it("locked doors carry no artwork data at all", async () => {
    const doors = await getDoors("00000000-0000-0000-0000-000000000001", DEC12);
    const locked = doors.filter((d) => d.state === "locked");
    expect(locked).toHaveLength(12);
    for (const d of locked) expect(Object.keys(d).sort()).toEqual(["day", "state", "unlockAt"]);
    expect(JSON.stringify(locked)).not.toMatch(/Work 13|image/);
    expect(await getUnlockedArtwork(13, DEC12)).toBeNull();
    expect((await getUnlockedArtwork(12, DEC12))?.title).toBe("Work 12");
  });
});
