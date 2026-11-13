import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { sign } from "@/lib/crypto";
import { assertSafeKey, type StorageAdapter } from "./types";

/** Outside `public/` and git-ignored; only reachable through the guarded image route. */
const ROOT = path.join(process.cwd(), "storage", "artworks");
const UPLOAD_TTL_MS = 10 * 60 * 1000;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

function fileFor(key: string): string {
  const file = path.resolve(ROOT, assertSafeKey(key));
  if (!file.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return file;
}

/** Local disk for development and the demo. Uploads go to `/api/admin/upload` with a signed, expiring token. */
export const localStorage: StorageAdapter = {
  name: "local",

  async put(key, body) {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  },

  async remove(key) {
    await rm(fileFor(key), { force: true });
  },

  async createUpload(key, contentType) {
    assertSafeKey(key);
    const token = sign(JSON.stringify({ key, exp: Date.now() + UPLOAD_TTL_MS }), env.sessionSecret());
    return { url: `/api/admin/upload?token=${encodeURIComponent(token)}`, method: "PUT", headers: { "Content-Type": contentType } };
  },

  async read(key) {
    try {
      const body = new Uint8Array(await readFile(fileFor(key)));
      const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
      return { body, contentType: CONTENT_TYPES[ext] ?? "application/octet-stream" };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
};
