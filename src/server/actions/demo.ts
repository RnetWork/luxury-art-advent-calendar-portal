"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { DEMO_PERSONAS } from "@/lib/demo-orders";
import { DEMO_CLOCK_COOKIE, signDemoClock } from "@/server/clock";
import { completeLogin } from "@/server/login";

const DEMO_ADMIN = { shopifyCustomerId: "admin-curator", email: "curator@example.com", firstName: "The", lastName: "Curator" };

function assertDemo() {
  if (!env.demoMode()) throw new Error("Demo mode is off");
}

export async function demoLogin(formData: FormData) {
  assertDemo();
  const key = z.string().max(40).parse(formData.get("persona"));
  if (key === "admin") {
    await completeLogin({ ...DEMO_ADMIN, email: env.adminEmails()[0] ?? DEMO_ADMIN.email }, "demo");
    redirect("/admin");
  }
  const p = DEMO_PERSONAS.find((x) => x.key === key);
  if (!p) throw new Error("Unknown persona");
  await completeLogin({ shopifyCustomerId: p.customerId, email: p.email, firstName: p.firstName, lastName: p.lastName }, "demo");
  redirect("/");
}

/** Time travel for the demo (signed cookie, ignored outside demo mode). */
export async function setDemoClock(iso: string | null) {
  assertDemo();
  const jar = await cookies();
  if (!iso) {
    jar.delete(DEMO_CLOCK_COOKIE);
    return;
  }
  const d = new Date(z.string().datetime().parse(iso));
  jar.set(DEMO_CLOCK_COOKIE, signDemoClock(d.toISOString()), { httpOnly: true, sameSite: "lax", path: "/" });
}
