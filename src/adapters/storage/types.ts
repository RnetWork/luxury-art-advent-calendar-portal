/** Where the browser sends an artwork file: a short-lived signed PUT (Vercel can't proxy print-size files). */
export type UploadTarget = { url: string; method: "PUT"; headers: Record<string, string> };

/**
 * Private artwork storage. Keys are random (`art/<uuid>.<ext>`); nothing is ever public.
 * An adapter serves files either by streaming them (`read`, local disk) or by handing out a
 * short-lived signed URL (`signedUrl`, Supabase). `/api/artworks/:id/image` is the only caller of either.
 */
export interface StorageAdapter {
  readonly name: "local" | "supabase";
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  createUpload(key: string, contentType: string): Promise<UploadTarget>;
  read?(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  signedUrl?(key: string, expiresInSeconds: number): Promise<string | null>;
}

/** Keys are generated server-side, but check anyway: no traversal, no absolute paths, no odd characters. */
export function assertSafeKey(key: string): string {
  if (!/^[a-z0-9-]+(\/[A-Za-z0-9-]+)*\.[a-z0-9]+$/.test(key)) throw new Error("Invalid storage key");
  return key;
}
