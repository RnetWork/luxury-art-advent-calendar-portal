import { NextResponse } from "next/server";
import { authorizeUrl, shopifyAuthConfigured } from "@/adapters/auth/shopify";
import { env } from "@/lib/env";
import { OAUTH_COOKIE } from "@/lib/cookies";
import { pkceChallenge, randomToken, sign } from "@/lib/crypto";

export async function GET() {
  const base = env.appUrl();
  if (!shopifyAuthConfigured()) {
    return NextResponse.redirect(new URL(env.demoMode() ? "/login/dev" : "/?error=login_unavailable", base));
  }
  const state = randomToken(16);
  const nonce = randomToken(16);
  const verifier = randomToken(48);
  const url = await authorizeUrl({ state, nonce, challenge: pkceChallenge(verifier), redirectUri: `${base}/auth/callback` });
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, sign(JSON.stringify({ state, nonce, verifier, exp: Date.now() + 600_000 }), env.sessionSecret()), {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/auth",
    maxAge: 600,
  });
  return res;
}
