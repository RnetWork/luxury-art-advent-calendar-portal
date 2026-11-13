// One-time local setup: .env (with a fresh SESSION_SECRET), database "advent" in the local Docker Postgres,
// migrations and demo seed. Safe to run again.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

if (!existsSync(".env")) {
  const env = readFileSync(".env.example", "utf8").replace(/^SESSION_SECRET=$/m, `SESSION_SECRET=${randomBytes(32).toString("base64")}`);
  writeFileSync(".env", env);
  console.log("Created .env");
}

const url = new URL(readFileSync(".env", "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim());
const dbName = url.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) throw new Error(`Unexpected database name: ${dbName}`);
url.pathname = "/postgres";
const sql = postgres(url.toString(), { max: 1 });
const exists = await sql`select 1 from pg_database where datname = ${dbName}`;
if (!exists.length) {
  await sql.unsafe(`create database ${dbName}`);
  console.log(`Created database ${dbName}`);
}
await sql.end();

execSync("pnpm db:migrate", { stdio: "inherit" });
execSync("pnpm db:seed", { stdio: "inherit" });
console.log("\nReady. Run `pnpm dev` and open http://localhost:3100");
