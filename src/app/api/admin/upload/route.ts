import { NextResponse } from "next/server";
import { localStorage } from "@/adapters/storage/local";
import { env } from "@/lib/env";
import { unsign } from "@/lib/crypto";
import { getViewer } from "@/server/session";

const MAX_BYTES = 40 * 1024 * 1024;

/** Local-disk stand-in for Supabase's signed upload URL (admin + short-lived signed token). */
export async function PUT(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new NextResponse("Forbidden", { status: 403 });
  const raw = unsign(new URL(req.url).searchParams.get("token") ?? undefined, env.sessionSecret());
  if (!raw) return new NextResponse("Bad token", { status: 400 });
  const { key, exp } = JSON.parse(raw) as { key: string; exp: number };
  if (exp < Date.now()) return new NextResponse("Expired", { status: 400 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength > MAX_BYTES) return new NextResponse("Too large", { status: 413 });
  await localStorage.put(key, body, req.headers.get("content-type") ?? "application/octet-stream");
  return NextResponse.json({ ok: true });
}
