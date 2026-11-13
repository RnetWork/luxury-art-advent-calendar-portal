import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artwork } from "@/db/schema";
import { ArtworkForm } from "@/components/admin/ArtworkForm";
import { env } from "@/lib/env";
import { formatNy, unlockAt } from "@/lib/unlock";

export default async function EditArtwork({ params }: { params: Promise<{ day: string }> }) {
  const day = Number((await params).day);
  if (!Number.isInteger(day) || day < 1 || day > 24) notFound();
  const [a] = await db.select().from(artwork).where(eq(artwork.day, day));
  const year = env.adventYear();
  return (
    <div className="space-y-6">
      <Link href="/admin/artworks" className="text-xs text-muted hover:text-ivory">
        ← All doors
      </Link>
      <div>
        <p className="eyebrow">Day {day}</p>
        <h1 className="mt-2 font-display text-4xl font-light">{a?.title ?? "New artwork"}</h1>
        <p className="mt-1 text-sm text-muted">Unlocks {formatNy(unlockAt(year, day))} ET</p>
      </div>
      <ArtworkForm
        day={day}
        initial={{
          title: a?.title ?? "",
          artist: a?.artist ?? "",
          medium: a?.medium ?? "Archival pigment print on cotton rag",
          dimensions: a?.dimensions ?? "16 × 20 in (40.6 × 50.8 cm)",
          year: a?.year ?? year,
          description: a?.description ?? "",
          story: a?.story ?? "",
          printSku: a?.printSku ?? `${env.fulfillment.skuPrefix()}-${year}-${String(day).padStart(2, "0")}`,
          accent: a?.accent ?? null,
          published: a?.published ?? false,
          imageUrl: a?.imageKey ? `/api/artworks/${a.id}/image?v=${a.updatedAt.getTime()}` : null,
        }}
      />
    </div>
  );
}
