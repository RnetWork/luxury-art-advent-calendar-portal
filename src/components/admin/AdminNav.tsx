"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ demo }: { demo: boolean }) {
  const path = usePathname();
  const links = [
    ["/admin", "Overview"],
    ["/admin/artworks", "Artworks & schedule"],
    ["/admin/editions", "Editions"],
    ["/admin/fulfillment", "Fulfillment"],
    ["/admin/events", "Shopify events"],
    ...(demo ? [["/admin/demo", "Demo tools"]] : []),
  ];
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Admin">
      {links.map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href!);
        return (
          <Link
            key={href}
            href={href!}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-xs tracking-wide transition-colors ${active ? "bg-gold/15 text-gold-bright" : "text-muted hover:bg-white/5 hover:text-ivory"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border hairline bg-ink-900/60 p-5">
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-faint">{label}</p>
      <p className="mt-2 font-display text-4xl font-light text-ivory">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "gold" | "good" | "bad" | "warn"; children: React.ReactNode }) {
  const tones = {
    neutral: "border-white/10 text-muted",
    gold: "border-gold/40 text-gold-bright",
    good: "border-sage/40 text-sage",
    bad: "border-garnet/50 text-garnet",
    warn: "border-gold/60 bg-gold/10 text-gold-bright",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}
