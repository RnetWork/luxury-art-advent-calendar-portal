"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, CalendarDays, Images, LogOut, Package } from "lucide-react";
import { Monogram } from "./Monogram";

const LINKS = [
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/collection", label: "Collection", icon: Images },
  { href: "/certificate", label: "Certificate", icon: Award },
  { href: "/shipping", label: "Prints", icon: Package },
];

export function PortalNav({ house, edition, isAdmin }: { house: string; edition: string; isAdmin: boolean }) {
  const path = usePathname();
  const active = (href: string) => path === href || (href === "/calendar" && path.startsWith("/reveal"));
  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b hairline bg-ink-950/75 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
          <Link href="/calendar" className="flex items-center gap-3">
            <Monogram size={34} />
            <span className="hidden font-display text-lg tracking-wide text-ivory sm:inline">{house}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Portal">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={`relative px-4 py-2 text-[0.7rem] uppercase tracking-[0.24em] transition-colors ${active(l.href) ? "text-gold-bright" : "text-muted hover:text-ivory"}`}
              >
                {l.label}
                {active(l.href) && <span className="absolute inset-x-4 -bottom-[1px] h-px bg-gold" />}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="px-4 py-2 text-[0.7rem] uppercase tracking-[0.24em] text-muted hover:text-ivory">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden font-display text-sm italic text-parchment sm:inline">{edition}</span>
            <form action="/auth/logout" method="post">
              <button className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:text-gold-bright" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" strokeWidth={1.5} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Phone: bottom tab bar within thumb reach */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t hairline bg-ink-950/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Portal"
      >
        <div className="grid grid-cols-4">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6rem] uppercase tracking-[0.18em] ${active(l.href) ? "text-gold-bright" : "text-muted"}`}>
              <l.icon className="size-5" strokeWidth={1.25} />
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
