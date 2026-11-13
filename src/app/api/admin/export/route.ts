import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { exportBatch } from "@/db/schema";
import { getViewer } from "@/server/session";

/** Download a past export batch again (admin only). New exports are created by the exportOrders action. */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new Response("Forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("batch");
  const [batch] = id && /^[0-9a-f-]{36}$/i.test(id) ? await db.select().from(exportBatch).where(eq(exportBatch.id, id)) : await db.select().from(exportBatch).orderBy(desc(exportBatch.createdAt)).limit(1);
  if (!batch) return new Response("No exports yet", { status: 404 });
  return new Response(batch.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="print-orders-${batch.createdAt.toISOString().slice(0, 10)}-${batch.id.slice(0, 8)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
