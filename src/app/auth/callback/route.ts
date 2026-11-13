import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/adapters/auth/shopify";
import { OAUTH_COOKIE } from "@/lib/cookies";
import { env } from "@/lib/env";
import { safeEqual, unsign } from "@/lib/crypto";
import { completeLogin } from "@/server/login";

export async function GET(req: NextRequest) {
  const base = env.appUrl();
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/?error=${code}`, base));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/auth" });
    return res;
  };
  const raw = unsign(req.cookies.get(OAUTH_COOKIE)?.value, env.sessionSecret());
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!raw || !code || !state) return fail("login_expired");
  const saved = JSON.parse(raw) as { state: string; nonce: string; verifier: string; exp: number };
  if (saved.exp < Date.now() || !safeEqual(saved.state, state)) return fail("login_expired");

  try {
    const identity = await exchangeCode({ code, verifier: saved.verifier, redirectUri: `${base}/auth/callback`, nonce: saved.nonce });
    await completeLogin(identity, "shopify");
  } catch (e) {
    console.error("[auth] callback failed", e);
    return fail("login_failed");
  }
  const res = NextResponse.redirect(new URL("/", base));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/auth" });
  return res;
}
