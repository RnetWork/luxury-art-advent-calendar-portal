import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, webhookEvent } from "@/db/schema";
import { Badge } from "@/components/admin/AdminNav";

const fmt = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

export default async function AdminEvents() {
  const [events, logs] = await Promise.all([
    db.select().from(webhookEvent).orderBy(desc(webhookEvent.receivedAt)).limit(100),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(60),
  ]);
  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Shopify events</p>
        <h1 className="mt-2 font-display text-4xl font-light">Webhook log</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Every verified webhook is recorded once by its Shopify webhook id. Replays are acknowledged without being processed twice; failures are retried by Shopify.</p>
      </div>
      <section className="overflow-x-auto rounded-xl border hairline">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b hairline text-[0.65rem] uppercase tracking-[0.18em] text-faint">
            <tr>
              <th className="p-3">Received (ET)</th>
              <th className="p-3">Topic</th>
              <th className="p-3">Order</th>
              <th className="p-3">Webhook id</th>
              <th className="p-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="p-3 whitespace-nowrap text-muted">{fmt(e.receivedAt)}</td>
                <td className="p-3 text-ivory">{e.topic}</td>
                <td className="p-3 text-muted">{(e.payload as { name?: string; order_id?: number } | null)?.name ?? `order ${(e.payload as { order_id?: number } | null)?.order_id ?? ""}`}</td>
                <td className="p-3 font-mono text-xs text-faint">{e.externalId.slice(0, 13)}</td>
                <td className="p-3">
                  <Badge tone={e.status === "processed" ? "good" : e.status === "failed" ? "bad" : "neutral"}>{e.status}</Badge>
                  {e.error && <span className="ml-2 text-xs text-garnet">{e.error}</span>}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td className="p-4 text-muted" colSpan={5}>
                  No webhooks received yet. The demo seed applies orders directly; use Demo tools to send real signed webhooks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="font-display text-2xl">Audit log</h2>
        <ul className="mt-3 divide-y divide-white/5 rounded-xl border hairline text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-3 gap-y-1 p-3">
              <span className="whitespace-nowrap text-faint">{fmt(l.createdAt)}</span>
              <span className="text-ivory">{l.action}</span>
              <span className="text-muted">{l.target}</span>
              <span className="text-faint">by {l.actor}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
