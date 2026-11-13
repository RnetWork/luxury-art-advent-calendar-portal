"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import type { Door } from "@/server/artworks";

// A traditional advent calendar scatters its numbers. Fixed order, so everyone's calendar looks the same.
const ORDER = [7, 18, 2, 23, 11, 15, 20, 4, 13, 9, 24, 1, 16, 6, 21, 10, 3, 19, 12, 22, 5, 14, 8, 17];

const dateLabel = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(iso));

export function DoorGrid({ doors, today }: { doors: Door[]; today: number }) {
  const byDay = new Map(doors.map((d) => [d.day, d]));
  return (
    <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6 lg:gap-5" aria-label="Advent calendar">
      {ORDER.map((day) => (
        <li key={day}>
          <DoorTile door={byDay.get(day)!} isToday={day === today} />
        </li>
      ))}
    </ol>
  );
}

function DoorTile({ door, isToday }: { door: Door; isToday: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const [scope, animate] = useAnimate();
  const open = door.state === "open";
  const opened = open && door.opened;

  const onClick = () => {
    if (!open) {
      if (!reduce) animate(scope.current, { x: [0, -5, 5, -3, 3, 0] }, { duration: 0.45 });
      return;
    }
    if (opened || reduce) {
      router.push(`/reveal/${door.day}${opened ? "?instant=1" : ""}`);
      return;
    }
    setOpening(true);
    router.prefetch(`/reveal/${door.day}`);
    setTimeout(() => router.push(`/reveal/${door.day}`), 900);
  };

  const label = open ? `Day ${door.day}${opened ? `: ${door.artwork.title}` : ", ready to open"}` : door.state === "preparing" ? `Day ${door.day}, being prepared` : `Day ${door.day}, opens ${dateLabel(door.unlockAt)}`;

  return (
    <button
      ref={scope}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-disabled={!open}
      className="group relative block aspect-[4/5] w-full [perspective:900px]"
    >
      {/* What's behind the door: the artwork (only sent to the browser once unlocked) or warm light */}
      <div className="absolute inset-0 overflow-hidden rounded-[3px] bg-ink-900">
        {open && door.artwork.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- guarded, private image route
          <img src={door.artwork.imageUrl} alt="" className={`size-full object-cover transition-transform duration-[1.6s] ease-[var(--ease-gallery)] ${opened ? "group-hover:scale-105" : "scale-110"}`} loading="lazy" decoding="async" />
        ) : (
          <div className="size-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--color-gold)_25%,transparent),transparent_70%)]" />
        )}
        {opened && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent p-2.5 pt-8 text-left sm:p-3">
            <span className="block font-display text-sm leading-tight text-ivory sm:text-base">{door.artwork.title}</span>
          </div>
        )}
      </div>

      {/* The door itself */}
      {!opened && (
        <motion.div
          className={`absolute inset-0 origin-left rounded-[3px] border [transform-style:preserve-3d] ${
            open ? (isToday ? "border-gold/80 bg-ink-850 shadow-[0_0_48px_-6px_var(--color-gold)]" : "border-gold/35 bg-ink-850") : "hairline bg-ink-850/95"
          }`}
          animate={opening ? { rotateY: -112, boxShadow: "0 0 80px 0 rgba(200,167,95,0.35)" } : { rotateY: 0 }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        >
          <div className="pointer-events-none absolute inset-1.5 rounded-[2px] border border-white/[0.04] sm:inset-2" />
          <div className="flex size-full flex-col items-center justify-center">
            <span
              className={`font-display font-light leading-none transition-colors duration-500 ${
                open ? "text-gold-foil text-5xl sm:text-6xl" : "text-4xl text-ivory/25 group-hover:text-ivory/40 sm:text-5xl"
              }`}
            >
              {door.day}
            </span>
            <span className={`mt-2 text-[0.55rem] uppercase tracking-[0.28em] sm:text-[0.6rem] ${open ? "text-gold" : "text-faint"}`}>
              {open ? (isToday ? "Today" : "Open me") : door.state === "preparing" ? "Preparing" : dateLabel(door.unlockAt)}
            </span>
            {!open && <Lock className="absolute top-2.5 right-2.5 size-3 text-faint/70" strokeWidth={1.5} aria-hidden />}
          </div>
          {/* a small brass knob */}
          <span className={`absolute top-1/2 right-2 size-1.5 -translate-y-1/2 rounded-full ${open ? "bg-gold" : "bg-ink-700"}`} />
          {open && isToday && !reduce && <span className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-gold/60 motion-safe:animate-pulse" />}
        </motion.div>
      )}
    </button>
  );
}
