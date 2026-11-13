import "server-only";
import { db, type Tx } from "@/db/client";
import { auditLog } from "@/db/schema";

export async function audit(actor: string, action: string, target?: string | null, meta?: Record<string, unknown>, tx?: Tx) {
  await (tx ?? db).insert(auditLog).values({ actor, action, target: target ?? null, meta: meta ?? null });
}
