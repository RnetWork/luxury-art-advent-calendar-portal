import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { destroySession } from "@/server/session";

// POST only (a form button). SameSite=Lax session cookies are not sent on cross-site POSTs.
export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/", env.appUrl()), 303);
}
