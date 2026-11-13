import { DemoBar } from "@/components/DemoBar";
import { PortalNav } from "@/components/PortalNav";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { editionLabel } from "@/lib/format";
import { isDemoClockSet, now } from "@/server/clock";
import { requireCollector } from "@/server/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireCollector();
  const demo = env.demoMode();
  const [current, simulated] = demo ? await Promise.all([now(), isDemoClockSet()]) : [new Date(), false];
  return (
    <div className="ambient min-h-dvh pb-24 md:pb-0">
      <PortalNav house={BRAND.house} edition={editionLabel(viewer.access.editionNumber, env.editionSize())} isAdmin={viewer.isAdmin} />
      {children}
      {demo && <DemoBar year={env.adventYear()} nowIso={current.toISOString()} simulated={simulated} />}
    </div>
  );
}
