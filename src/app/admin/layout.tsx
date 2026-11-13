import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { Monogram } from "@/components/Monogram";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { requireAdmin } from "@/server/session";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-30 border-b hairline bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-3">
              <Monogram size={30} />
              <span className="font-display text-lg">{BRAND.collection}</span>
              <span className="text-[0.6rem] uppercase tracking-[0.3em] text-gold">Admin</span>
            </Link>
            <div className="flex items-center gap-3 lg:hidden">
              <form action="/auth/logout" method="post">
                <button className="text-xs text-muted hover:text-ivory">Sign out</button>
              </form>
            </div>
          </div>
          <AdminNav demo={env.demoMode()} />
          <div className="hidden items-center gap-4 text-xs text-muted lg:flex">
            <span>{viewer.email}</span>
            {viewer.access && <Link href="/calendar" className="hover:text-ivory">Portal</Link>}
            <form action="/auth/logout" method="post">
              <button className="hover:text-ivory">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
