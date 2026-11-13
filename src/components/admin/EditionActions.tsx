"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignEditionNumber, releaseRetiredEdition, retryActivation } from "@/server/actions/admin";

export function EditionActions({ entitlementId, status, reviewReason }: { entitlementId: string; status: string; reviewReason: string | null }) {
  const router = useRouter();
  const [n, setN] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? "Done" : (r.error ?? "Failed"));
      if (r.ok) router.refresh();
    });

  if (status === "needs_review" && reviewReason === "sold_out") {
    return (
      <div className="flex items-center gap-2">
        <button disabled={pending} onClick={() => run(() => retryActivation(entitlementId))} className="rounded-full border hairline px-3 py-1.5 text-xs hover:border-gold">
          Retry assignment
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    );
  }
  if (status !== "active") return <span className="text-xs text-faint">—</span>;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => assignEditionNumber(entitlementId, Number(n)));
      }}
    >
      <input value={n} onChange={(e) => setN(e.target.value)} inputMode="numeric" placeholder="No." aria-label="Edition number" className="w-16 rounded-md border hairline bg-ink-900 px-2 py-1.5 text-xs" />
      <button disabled={pending || !n} className="rounded-full border hairline px-3 py-1.5 text-xs hover:border-gold disabled:opacity-40">
        Assign
      </button>
      {msg && <span className="max-w-48 text-xs text-muted">{msg}</span>}
    </form>
  );
}

export function ReleaseButton({ number }: { number: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await releaseRetiredEdition(number);
          if (r.ok) router.refresh();
        })
      }
      className="rounded-full border border-garnet/50 px-2.5 py-1 text-garnet hover:bg-garnet/10"
    >
      No. {number}
    </button>
  );
}
