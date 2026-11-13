import "server-only";
import { env } from "@/lib/env";
import { localStorage } from "./local";
import { supabaseStorage } from "./supabase";
import type { StorageAdapter } from "./types";

/** Supabase when configured, otherwise local disk (`./storage/artworks`). */
export function storage(): StorageAdapter {
  return env.supabase.url() && env.supabase.serviceKey() ? supabaseStorage : localStorage;
}
export type { StorageAdapter, UploadTarget } from "./types";
