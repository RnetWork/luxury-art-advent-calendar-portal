import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db/client";
import { collector, edition, entitlement, session } from "@/db/schema";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";

export const SESSION_COOKIE = "adv_session";
const SESSION_DAYS = 30;

export async function createSession(input: { collectorId: string | null; email: string; isAdmin: boolean }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(session).values({ tokenHash: sha256(token), collectorId: input.collectorId, email: input.email.toLowerCase(), isAdmin: input.isAdmin, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(session).where(eq(session.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export type Viewer = {
  sessionId: string;
  email: string;
  /** Re-checked against ADMIN_EMAILS on every request, so removing an email revokes admin at once. */
  isAdmin: boolean;
  collector: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  access: { entitlementId: string; editionNumber: number | null; status: "active" } | null;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ s: session, c: collector })
    .from(session)
    .leftJoin(collector, eq(collector.id, session.collectorId))
    .where(and(eq(session.tokenHash, sha256(token)), gt(session.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  const isAdmin = row.s.isAdmin && env.adminEmails().includes(row.s.email);
  let access: Viewer["access"] = null;
  if (row.c) {
    const [ent] = await db
      .select({ id: entitlement.id, editionNumber: edition.number })
      .from(entitlement)
      .leftJoin(edition, and(eq(edition.entitlementId, entitlement.id), eq(edition.status, "assigned")))
      .where(and(eq(entitlement.collectorId, row.c.id), eq(entitlement.status, "active")))
      .limit(1);
    if (ent) access = { entitlementId: ent.id, editionNumber: ent.editionNumber ?? null, status: "active" };
  }
  return {
    sessionId: row.s.id,
    email: row.s.email,
    isAdmin,
    collector: row.c ? { id: row.c.id, firstName: row.c.firstName, lastName: row.c.lastName, email: row.c.email } : null,
    access,
  };
});

/** Portal pages: a signed-in collector with an ACTIVE (paid, not refunded) entitlement. */
export async function requireCollector() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (!v.collector || !v.access) redirect("/no-access");
  return v as Viewer & { collector: NonNullable<Viewer["collector"]>; access: NonNullable<Viewer["access"]> };
}

export async function requireAdmin() {
  const v = await getViewer();
  if (!v) redirect("/");
  if (!v.isAdmin) redirect("/calendar");
  return v;
}
