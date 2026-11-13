"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { setDemoClock } from "@/server/actions/demo";

/** Demo only: travel through December to see doors unlock. The server re-checks every unlock. */
export function DemoBar({ year, nowIso, simulated }: { year: number; nowIso: string; simulated: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  // 00:00:30 New York (UTC-5 in December) on the chosen day.
  const at = (month: number, day: number) => new Date(Date.UTC(year, month - 1, day, 5, 0, 30)).toISOString();
  const go = (iso: string | null) =>
    start(async () => {
      await setDemoClock(iso);
      router.refresh();
    });
  const now = new Date(nowIso);
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
  const jumps: Array<[string, string]> = [["Nov 30", at(11, 30)], ["Dec 1", at(12, 1)], ["Dec 7", at(12, 7)], ["Dec 12", at(12, 12)], ["Dec 18", at(12, 18)], ["Dec 24", at(12, 24)]];

  return (
    <div className="no-print fixed right-3 bottom-20 z-50 md:right-5 md:bottom-5">
      {open && (
        <div className="mb-2 w-64 rounded-2xl border hairline bg-ink-900/95 p-4 shadow-2xl backdrop-blur-xl">
          <p className="eyebrow mb-1">Demo clock</p>
          <p className="mb-3 text-xs text-muted">Unlocks use New York time. This control exists only in demo mode.</p>
          <div className="grid grid-cols-3 gap-1.5">
            {jumps.map(([l, iso]) => (
              <button key={l} disabled={pending} onClick={() => go(iso)} className="rounded-lg border hairline px-2 py-2 text-xs text-parchment hover:border-gold hover:text-gold-bright disabled:opacity-50">
                {l}
              </button>
            ))}
          </div>
          <button disabled={pending} onClick={() => go(null)} className="mt-2 w-full rounded-lg px-2 py-2 text-xs text-muted hover:text-ivory">
            Back to real time
          </button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="ml-auto flex items-center gap-2 rounded-full border hairline bg-ink-900/90 px-4 py-2.5 text-xs text-parchment shadow-xl backdrop-blur-xl hover:border-gold" aria-expanded={open}>
        <Clock className="size-3.5 text-gold" strokeWidth={1.5} />
        {simulated ? label : "Demo clock"}
      </button>
    </div>
  );
}
