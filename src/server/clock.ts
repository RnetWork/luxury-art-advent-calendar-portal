import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { sign, unsign } from "@/lib/crypto";

export const DEMO_CLOCK_COOKIE = "adv_demo_clock";

/**
 * The server's idea of "now" for unlock checks. In demo mode a signed cookie may move the clock
 * (time travel through December). In production this is always the real time.
 */
export async function now(): Promise<Date> {
  if (!env.demoMode()) return new Date();
  try {
    const raw = unsign((await cookies()).get(DEMO_CLOCK_COOKIE)?.value, env.sessionSecret());
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d : new Date();
  } catch {
    return new Date(); // outside a request scope (scripts, tests)
  }
}

export async function isDemoClockSet(): Promise<boolean> {
  if (!env.demoMode()) return false;
  try {
    return Boolean(unsign((await cookies()).get(DEMO_CLOCK_COOKIE)?.value, env.sessionSecret()));
  } catch {
    return false;
  }
}

export const signDemoClock = (iso: string) => sign(iso, env.sessionSecret());
