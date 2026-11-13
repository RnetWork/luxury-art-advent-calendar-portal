import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { edition, entitlement } from "@/db/schema";

/**
 * Claim the lowest free edition number for an entitlement. Atomic: FOR UPDATE SKIP LOCKED means two
 * concurrent buyers never see the same free row, and unique constraints back it up. Null = sold out.
 */
export async function claimEdition(tx: Tx, entitlementId: string): Promise<number | null> {
  const existing = await tx.select({ n: edition.number }).from(edition).where(eq(edition.entitlementId, entitlementId));
  if (existing[0]) return existing[0].n;
  const rows = await tx.execute<{ number: number }>(sql`
    update edition set status = 'assigned', entitlement_id = ${entitlementId}, assigned_at = now()
    where number = (
      select number from edition where status = 'available' order by number limit 1 for update skip locked
    )
    returning number`);
  const n = rows[0]?.number ?? null;
  if (n != null) await tx.update(entitlement).set({ editionNumber: n, editionAssignedAt: new Date() }).where(eq(entitlement.id, entitlementId));
  return n;
}

/** Refund / cancel: the number is retired (not silently re-issued). An admin can release it later. */
export async function retireEdition(tx: Tx, entitlementId: string, note: string) {
  await tx.update(edition).set({ status: "retired", entitlementId: null, note }).where(eq(edition.entitlementId, entitlementId));
}

/** Admin: put a retired number back into the pool. Clears it from the old (revoked) entitlement. */
export async function releaseEdition(tx: Tx, number: number): Promise<boolean> {
  const rows = await tx.update(edition).set({ status: "available", note: null, assignedAt: null }).where(and(eq(edition.number, number), eq(edition.status, "retired"))).returning();
  if (!rows.length) return false;
  await tx.update(entitlement).set({ editionNumber: null }).where(and(eq(entitlement.editionNumber, number), sql`${entitlement.status} <> 'active'`));
  return true;
}

/**
 * Admin: give an active entitlement a specific AVAILABLE number (e.g. a collector asked for No. 24).
 * Their previous number goes back to the pool. Fails cleanly if the number is taken.
 */
export async function assignSpecificEdition(tx: Tx, entitlementId: string, number: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const [ent] = await tx.select().from(entitlement).where(eq(entitlement.id, entitlementId)).for("update");
  if (!ent || ent.status !== "active") return { ok: false, error: "Only active collectors can receive an edition number." };
  const target = await tx.execute<{ number: number }>(sql`select number from edition where number = ${number} and status = 'available' for update`);
  if (!target[0]) return { ok: false, error: `No. ${number} is not available.` };
  await tx.update(edition).set({ status: "available", entitlementId: null, assignedAt: null }).where(eq(edition.entitlementId, entitlementId));
  await tx.update(entitlement).set({ editionNumber: null }).where(eq(entitlement.id, entitlementId));
  await tx.update(edition).set({ status: "assigned", entitlementId, assignedAt: new Date() }).where(eq(edition.number, number));
  await tx.update(entitlement).set({ editionNumber: number, editionAssignedAt: new Date() }).where(eq(entitlement.id, entitlementId));
  return { ok: true };
}

/** Make sure rows 1..size exist (idempotent; never deletes). */
export async function ensureEditionPool(tx: Tx, size: number) {
  await tx.execute(sql`insert into edition (number) select g from generate_series(1, ${size}) g on conflict do nothing`);
}
