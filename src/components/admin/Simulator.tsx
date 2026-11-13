"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { simulateShopify } from "@/server/actions/admin";
import { setDemoClock } from "@/server/actions/demo";

type Kind = Parameters<typeof simulateShopify>[0]["kind"];

export function Simulator({ orders, year, nowIso, simulated }: { orders: Array<{ name: string; label: string }>; year: number; nowIso: string; simulated: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState(orders[0]?.name ?? "");
  const [log, setLog] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const run = (kind: Kind) =>
    start(async () => {
      const r = await simulateShopify({ kind, orderName: order });
      setLog((l) => [r.ok ? r.data : `Error: ${r.error}`, ...l].slice(0, 12));
      router.refresh();
    });
  const clock = (iso: string | null) =>
    start(async () => {
      await setDemoClock(iso);
      router.refresh();
    });
  const btn = "rounded-full border hairline px-4 py-2 text-xs text-parchment hover:border-gold hover:text-gold-bright disabled:opacity-40";
  const at = (m: number, d: number, h = 0) => new Date(Date.UTC(year, m - 1, d, h + 5, 0, 30)).toISOString();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border hairline bg-ink-900/40 p-5">
        <h2 className="font-display text-2xl">New orders</h2>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={pending} onClick={() => run("purchase")}>
            Paid purchase
          </button>
          <button className={btn} disabled={pending} onClick={() => run("pending")}>
            Order with pending payment
          </button>
        </div>
        <h2 className="pt-2 font-display text-2xl">Existing order</h2>
        <select value={order} onChange={(e) => setOrder(e.target.value)} className="w-full rounded-lg border hairline bg-ink-900 px-3 py-2 text-sm" aria-label="Order">
          {orders.map((o) => (
            <option key={o.name} value={o.name}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={pending} onClick={() => run("pay")}>Payment captured</button>
          <button className={btn} disabled={pending} onClick={() => run("refund")}>Full refund</button>
          <button className={btn} disabled={pending} onClick={() => run("cancel")}>Cancel order</button>
          <button className={btn} disabled={pending} onClick={() => run("fail")}>Payment failed / voided</button>
          <button className={btn} disabled={pending} onClick={() => run("duplicate")}>Send same webhook twice</button>
          <button className={btn} disabled={pending} onClick={() => run("forged")}>Forged signature</button>
        </div>
      </section>
      <section className="space-y-4 rounded-xl border hairline bg-ink-900/40 p-5">
        <h2 className="font-display text-2xl">Demo clock</h2>
        <p className="text-sm text-muted">
          {simulated ? "Simulated" : "Real"} time: {new Date(nowIso).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={pending} onClick={() => clock(at(11, 30, 23))}>Nov 30, 11 pm</button>
          {[1, 5, 12, 20, 24].map((d) => (
            <button key={d} className={btn} disabled={pending} onClick={() => clock(at(12, d))}>
              Dec {d}
            </button>
          ))}
          <button className={btn} disabled={pending} onClick={() => clock(null)}>Real time</button>
        </div>
        <h2 className="pt-2 font-display text-2xl">Results</h2>
        <ul className="space-y-1.5 font-mono text-xs text-muted" aria-live="polite">
          {log.length === 0 && <li>Responses from the webhook endpoint appear here.</li>}
          {log.map((l, i) => (
            <li key={i} className={i === 0 ? "text-parchment" : ""}>
              {l}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
