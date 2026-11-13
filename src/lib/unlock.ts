// Daily unlock times. Pure functions, safe on client and server; the SERVER decides what is unlocked.
export const ADVENT_TIME_ZONE = "America/New_York";
export const DAYS = 24;

/** Offset (ms) of `timeZone` from UTC at the given instant, e.g. -5h for New York in December. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant of a wall-clock time in `timeZone` (handles DST by re-checking the offset). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, timeZone = ADVENT_TIME_ZONE): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  const second = guess - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** Door `day` (1–24) opens at midnight New York time on December `day`. */
export function unlockAt(year: number, day: number): Date {
  if (!Number.isInteger(day) || day < 1 || day > DAYS) throw new RangeError(`day must be 1–${DAYS}`);
  return zonedTimeToUtc(year, 12, day, 0, 0, ADVENT_TIME_ZONE);
}

export function isUnlocked(year: number, day: number, now: Date): boolean {
  return now.getTime() >= unlockAt(year, day).getTime();
}

/** How many doors are open at `now` (0–24). */
export function unlockedCount(year: number, now: Date): number {
  let n = 0;
  for (let d = 1; d <= DAYS; d++) if (isUnlocked(year, d, now)) n = d;
  return n;
}

/** The next door to open after `now`, or null when all are open. */
export function nextUnlock(year: number, now: Date): { day: number; at: Date } | null {
  const open = unlockedCount(year, now);
  return open >= DAYS ? null : { day: open + 1, at: unlockAt(year, open + 1) };
}

export function formatNy(date: Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: ADVENT_TIME_ZONE, ...opts }).format(date);
}
