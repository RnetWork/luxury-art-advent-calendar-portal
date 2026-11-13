import { describe, expect, it } from "vitest";
import { isUnlocked, nextUnlock, unlockAt, unlockedCount, zonedTimeToUtc } from "@/lib/unlock";

describe("unlock clock (America/New_York)", () => {
  it("opens door 1 at midnight New York time on Dec 1 (05:00 UTC, EST)", () => {
    expect(unlockAt(2026, 1).toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(unlockAt(2026, 24).toISOString()).toBe("2026-12-24T05:00:00.000Z");
  });

  it("is locked one second before and open exactly at the unlock instant", () => {
    const at = unlockAt(2026, 12).getTime();
    expect(isUnlocked(2026, 12, new Date(at - 1000))).toBe(false);
    expect(isUnlocked(2026, 12, new Date(at))).toBe(true);
  });

  it("does not open early for collectors in earlier time zones (e.g. 11 pm in Los Angeles on Nov 30 is 2 am ET)", () => {
    // 2026-12-01 04:59:59Z = Nov 30, 11:59:59 pm ET → still locked
    expect(unlockedCount(2026, new Date("2026-12-01T04:59:59Z"))).toBe(0);
    expect(unlockedCount(2026, new Date("2026-12-01T05:00:00Z"))).toBe(1);
  });

  it("counts doors and finds the next one", () => {
    const t = new Date("2026-12-12T15:00:00Z");
    expect(unlockedCount(2026, t)).toBe(12);
    expect(nextUnlock(2026, t)?.day).toBe(13);
    expect(nextUnlock(2026, new Date("2026-12-25T00:00:00Z"))).toBeNull();
  });

  it("handles DST transitions when converting wall-clock time", () => {
    expect(zonedTimeToUtc(2026, 7, 1, 0).toISOString()).toBe("2026-07-01T04:00:00.000Z"); // EDT
    expect(zonedTimeToUtc(2026, 3, 8, 12).toISOString()).toBe("2026-03-08T16:00:00.000Z"); // after spring-forward
    expect(zonedTimeToUtc(2026, 11, 1, 12).toISOString()).toBe("2026-11-01T17:00:00.000Z"); // after fall-back
  });

  it("rejects days outside 1–24", () => {
    expect(() => unlockAt(2026, 0)).toThrow();
    expect(() => unlockAt(2026, 25)).toThrow();
  });
});
