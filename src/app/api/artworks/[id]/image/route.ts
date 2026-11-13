import { NextResponse } from "next/server";
import { storage } from "@/adapters/storage";
import { canViewArtworkFile } from "@/server/artworks";
import { now } from "@/server/clock";
import { getViewer } from "@/server/session";

/** The ONLY way to read an artwork file: session → active entitlement (or admin) → unlocked + published. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const viewer = await getViewer();
  const check = await canViewArtworkFile(viewer, id, await now());
  const noStore = { "Cache-Control": "private, no-store" };
  if (!check.ok) return new NextResponse(check.status === 401 ? "Unauthorized" : "Not found", { status: check.status, headers: noStore });

  const store = storage();
  const key = check.artwork.imageKey!;
  if (store.signedUrl) {
    const url = await store.signedUrl(key, 60);
    if (!url) return new NextResponse("Not found", { status: 404, headers: noStore });
    return NextResponse.redirect(url, { status: 302, headers: noStore });
  }
  const file = await store.read!(key);
  if (!file) return new NextResponse("Not found", { status: 404, headers: noStore });
  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      // private: browsers may cache for this user, shared caches/CDN never.
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
