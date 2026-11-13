import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Shopify webhook HMAC: base64(HMAC-SHA256(secret, raw body)). */
export function shopifyHmac(rawBody: string | Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

export function verifyShopifyHmac(rawBody: string | Buffer, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  return safeEqual(shopifyHmac(rawBody, secret), header.trim());
}

/** Small signed values for cookies (OAuth state, demo clock): `<payload>.<hmac>`. */
export function sign(value: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${Buffer.from(value).toString("base64url")}.${mac}`;
}

export function unsign(signed: string | undefined, secret: string): string | null {
  if (!signed) return null;
  const [payload, mac] = signed.split(".");
  if (!payload || !mac) return null;
  const value = Buffer.from(payload, "base64url").toString();
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  return safeEqual(mac, expected) ? value : null;
}

/** PKCE S256 challenge for a verifier. */
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
