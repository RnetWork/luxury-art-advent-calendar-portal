"use client";

import { useEffect, useState } from "react";

/** Live countdown to `targetIso`. `offsetMs` keeps it in step with the server (or demo) clock. */
export function Countdown({ targetIso, serverNowIso }: { targetIso: string; serverNowIso: string }) {
  const [offset] = useState(() => new Date(serverNowIso).getTime() - Date.now());
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offset]);
  const ms = Math.max(0, new Date(targetIso).getTime() - (now ?? new Date(serverNowIso).getTime()));
  const parts = [
    ["days", Math.floor(ms / 864e5)],
    ["hours", Math.floor(ms / 36e5) % 24],
    ["min", Math.floor(ms / 6e4) % 60],
    ["sec", Math.floor(ms / 1e3) % 60],
  ] as const;
  return (
    <div className="flex items-end justify-center gap-4 sm:gap-7" role="timer" aria-live="off">
      {parts.map(([label, v]) => (
        <div key={label} className="text-center">
          <div className="font-display text-4xl font-light tabular-nums text-ivory sm:text-5xl">{String(v).padStart(2, "0")}</div>
          <div className="mt-1 text-[0.6rem] uppercase tracking-[0.3em] text-faint">{label}</div>
        </div>
      ))}
    </div>
  );
}
