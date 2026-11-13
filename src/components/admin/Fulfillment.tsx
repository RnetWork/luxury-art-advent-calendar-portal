"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "./AdminNav";
import { exportOrders, saveFulfillment } from "@/server/actions/admin";
import { CARRIERS } from "@/lib/tracking";

export function ExportButton({ ready }: { ready: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="btn-gold"
        disabled={pending || ready === 0}
        onClick={() =>
          start(async () => {
            const r = await exportOrders();
            if (!r.ok) return setMsg(r.error);
            if (!r.data) return setMsg("Nothing ready to export.");
            const blob = new Blob([r.data.csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = r.data.filename;
            a.click();
            URL.revokeObjectURL(a.href);
            setMsg(`Exported ${r.data.count} orders (${r.data.count * 24} prints).`);
            router.refresh();
          })
        }
      >
        {pending ? "Exporting…" : `Export ${ready} ready for the lab`}
      </button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}

type Row = {
  id: string;
  status: string;
  statusLabel: string;
  next: Array<{ value: string; label: string }>;
  edition: number | null;
  name: string;
  email: string;
  order: string;
  city: string | null;
  holdReason: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

const TONE: Record<string, "neutral" | "gold" | "good" | "bad" | "warn"> = { on_hold: "warn", ready: "gold", submitted: "neutral", in_production: "neutral", shipped: "good", delivered: "good", cancelled: "bad" };

export function FulfillmentRow({ row }: { row: Row }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(row.carrier ?? "UPS");
  const [tracking, setTracking] = useState(row.trackingNumber ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canTrack = ["submitted", "in_production", "shipped"].includes(row.status);

  const save = (input: Parameters<typeof saveFulfillment>[0]) =>
    start(async () => {
      const r = await saveFulfillment(input);
      setMsg(r.ok ? "Saved" : r.error);
      if (r.ok) router.refresh();
    });

  return (
    <div className="grid gap-3 rounded-xl border hairline bg-ink-900/40 p-4 lg:grid-cols-[90px_1.2fr_1fr_1.6fr] lg:items-center">
      <div className="font-display text-2xl text-gold-bright">{row.edition ? `No. ${row.edition}` : "—"}</div>
      <div>
        <div className="text-sm text-ivory">
          {row.name} <span className="text-muted">· {row.order}</span>
        </div>
        <div className="text-xs text-muted">{row.city ?? <span className="text-garnet">No shipping address</span>}</div>
        {row.holdReason && <div className="mt-1 text-xs text-gold-bright">{row.holdReason}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[row.status]}>{row.statusLabel}</Badge>
        {row.next.length > 0 && (
          <select
            aria-label="Change status"
            className="rounded-md border hairline bg-ink-900 px-2 py-1 text-xs text-parchment"
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && save({ id: row.id, status: e.target.value as never })}
          >
            <option value="">Move to…</option>
            {row.next.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canTrack ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ id: row.id, carrier: carrier as never, trackingNumber: tracking });
            }}
          >
            <select aria-label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="rounded-md border hairline bg-ink-900 px-2 py-1.5 text-xs">
              {CARRIERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input aria-label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" className="w-40 rounded-md border hairline bg-ink-900 px-2 py-1.5 font-mono text-xs" />
            <button disabled={pending || !tracking} className="rounded-full border hairline px-3 py-1.5 text-xs hover:border-gold disabled:opacity-40">
              Save tracking
            </button>
          </form>
        ) : (
          row.trackingNumber && <span className="font-mono text-xs text-muted">{row.carrier} {row.trackingNumber}</span>
        )}
        {row.trackingUrl && (
          <a href={row.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gold">
            Track
          </a>
        )}
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </div>
  );
}
