import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
   
  var __adventSql: ReturnType<typeof postgres> | undefined;
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// prepare:false so it works through Supabase's transaction pooler (port 6543).
export const sqlClient = globalThis.__adventSql ?? postgres(url, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__adventSql = sqlClient;

export const db = drizzle(sqlClient, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
