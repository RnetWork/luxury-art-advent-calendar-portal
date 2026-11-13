import "server-only";
import { env } from "@/lib/env";
import { assertSafeKey, type StorageAdapter } from "./types";

/**
 * Supabase Storage over its REST API (no supabase-js, see DECISIONS A-2), private bucket, service-role key.
 * The key never leaves the server; the browser only ever sees signed URLs.
 */
const base = () => `${env.supabase.url().replace(/\/+$/, "")}/storage/v1`;
const bucket = () => encodeURIComponent(env.supabase.bucket());
const objectPath = (key: string) => assertSafeKey(key).split("/").map(encodeURIComponent).join("/");

async function call(pathname: string, init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
  const key = env.supabase.serviceKey();
  return fetch(`${base()}${pathname}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${key}`, apikey: key, ...init.headers },
  });
}

async function fail(res: Response, what: string): Promise<never> {
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  throw new Error(`Supabase storage ${what} failed (${res.status}) ${detail}`.trim());
}

export const supabaseStorage: StorageAdapter = {
  name: "supabase",

  async put(key, body, contentType) {
    const res = await call(`/object/${bucket()}/${objectPath(key)}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "true" },
      body: Buffer.from(body),
    });
    if (!res.ok) await fail(res, "upload");
  },

  async remove(key) {
    const res = await call(`/object/${bucket()}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [assertSafeKey(key)] }),
    });
    if (!res.ok) await fail(res, "delete");
  },

  /** Signed upload URL (valid 2 hours on Supabase's side); the browser PUTs the file straight to the bucket. */
  async createUpload(key, contentType) {
    const res = await call(`/object/upload/sign/${bucket()}/${objectPath(key)}`, { method: "POST" });
    if (!res.ok) await fail(res, "signed upload");
    const { url } = (await res.json()) as { url: string };
    return { url: `${base()}${url}`, method: "PUT", headers: { "Content-Type": contentType } };
  },

  async signedUrl(key, expiresInSeconds) {
    const res = await call(`/object/sign/${bucket()}/${objectPath(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) await fail(res, "signed URL");
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${base()}${signedURL}`;
  },
};
