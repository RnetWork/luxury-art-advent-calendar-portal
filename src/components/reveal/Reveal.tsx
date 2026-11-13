"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import type { PublicArtwork } from "@/server/artworks";
import { roman } from "@/lib/format";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Cinematic reveal: numeral → gold line → the curtain parts → the work settles into its frame → text.
 * `instant` (coming from the gallery) and reduced motion skip straight to the final state.
 */
export function Reveal({ artwork: a, prevDay, nextDay, instant, editionSize }: { artwork: PublicArtwork; prevDay: number | null; nextDay: number | null; instant: boolean; editionSize: number }) {
  const reduce = useReducedMotion();
  const skip = instant || reduce;
  const [phase, setPhase] = useState<"intro" | "curtain" | "done">(skip ? "done" : "intro");
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (skip) return;
    const t1 = setTimeout(() => setPhase("curtain"), 2100);
    const t2 = setTimeout(() => setPhase("done"), 4300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [skip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showText = phase === "done";
  const ratio = a.width && a.height ? `${a.width} / ${a.height}` : "4 / 5";

  return (
    <main className="relative mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-8 sm:pt-12">
      {/* Intro overlay */}
      <AnimatePresence>
        {phase === "intro" && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950" exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.9, ease: EASE }}>
            <motion.div className="relative text-center" exit={{ scale: 1.08 }} transition={{ duration: 0.9, ease: EASE }}>
              <motion.p className="eyebrow" initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.32em" }} transition={{ duration: 1.4, ease: EASE }}>
                December {a.day}
              </motion.p>
              <motion.p className="mt-4 font-display text-8xl font-light text-gold-foil sm:text-9xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4, delay: 0.2, ease: EASE }}>
                {roman(a.day)}
              </motion.p>
              <motion.div className="mx-auto mt-8 h-px bg-gradient-to-r from-transparent via-gold to-transparent" initial={{ width: 0 }} animate={{ width: 220 }} transition={{ duration: 1.1, delay: 0.9, ease: EASE }} />
            </motion.div>
            <button onClick={() => setPhase("done")} className="absolute right-5 bottom-8 text-[0.65rem] uppercase tracking-[0.3em] text-faint hover:text-gold" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16">
        {/* The work, framed */}
        <div className="relative mx-auto w-full max-w-[min(100%,68dvh*0.8)]">
          <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-24 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-gold-bright)_16%,transparent),transparent_70%)]" />
          <motion.figure
            className="relative overflow-hidden bg-ink-900 p-[1px] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] [background:var(--gold-gradient)]"
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: phase === "intro" ? 0 : 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative overflow-hidden bg-ink-900" style={{ aspectRatio: ratio }}>
              {a.imageUrl && (
                 
                <motion.img
                  src={a.imageUrl}
                  alt={`${a.title} by ${a.artist}`}
                  onLoad={() => setLoaded(true)}
                  className="size-full object-cover"
                  initial={skip ? false : { scale: 1.14, filter: "brightness(0.4)" }}
                  animate={phase === "intro" ? {} : { scale: 1, filter: loaded ? "brightness(1)" : "brightness(0.4)" }}
                  transition={{ duration: 2.6, ease: EASE }}
                />
              )}
              {/* Curtain halves */}
              {!skip && (
                <>
                  <motion.div className="absolute inset-y-0 left-0 w-1/2 bg-ink-950" initial={{ x: 0 }} animate={phase === "intro" ? { x: 0 } : { x: "-101%" }} transition={{ duration: 1.8, ease: [0.76, 0, 0.24, 1] }} />
                  <motion.div className="absolute inset-y-0 right-0 w-1/2 bg-ink-950" initial={{ x: 0 }} animate={phase === "intro" ? { x: 0 } : { x: "101%" }} transition={{ duration: 1.8, ease: [0.76, 0, 0.24, 1] }} />
                </>
              )}
              <button onClick={() => setZoom(true)} className="absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full bg-ink-950/60 text-parchment opacity-80 backdrop-blur hover:text-gold-bright" aria-label="View full screen">
                <Maximize2 className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </motion.figure>
        </div>

        {/* Text */}
        <motion.div initial={skip ? false : { opacity: 0, y: 24 }} animate={showText ? { opacity: 1, y: 0 } : {}} transition={{ duration: 1.2, ease: EASE }} className="text-center lg:text-left">
          <p className="eyebrow">
            Day {roman(a.day)} · No. {a.day} of 24
          </p>
          <h1 className="mt-5 font-display text-5xl font-light leading-[1.02] sm:text-6xl">{a.title}</h1>
          <p className="mt-4 font-display text-2xl italic text-gold-bright">{a.artist}</p>
          <div className="mx-auto my-8 h-px w-16 bg-gold/60 lg:mx-0" />
          <p className="font-display text-xl leading-relaxed text-parchment">{a.description}</p>
          {a.story && <p className="mt-5 text-sm leading-relaxed text-muted">{a.story}</p>}
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t hairline pt-6 text-left text-xs">
            {[
              ["Medium", a.medium],
              ["Print size", a.dimensions],
              ["Year", a.year ? String(a.year) : "—"],
              ["Edition", `Limited to ${editionSize}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="uppercase tracking-[0.22em] text-faint">{k}</dt>
                <dd className="mt-1 text-parchment">{v}</dd>
              </div>
            ))}
          </dl>
          <nav className="mt-10 flex items-center justify-center gap-3 lg:justify-start" aria-label="Days">
            {prevDay ? (
              <Link href={`/reveal/${prevDay}?instant=1`} className="btn-ghost" aria-label={`Day ${prevDay}`}>
                <ChevronLeft className="size-4" /> {prevDay}
              </Link>
            ) : null}
            <Link href="/calendar" className="btn-ghost">
              Calendar
            </Link>
            {nextDay ? (
              <Link href={`/reveal/${nextDay}?instant=1`} className="btn-ghost" aria-label={`Day ${nextDay}`}>
                {nextDay} <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </nav>
        </motion.div>
      </div>

      {/* Full-screen viewer */}
      <AnimatePresence>
        {zoom && a.imageUrl && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/97 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(false)} role="dialog" aria-modal aria-label={a.title}>
            { }
            <motion.img src={a.imageUrl} alt={`${a.title} by ${a.artist}`} className="max-h-full max-w-full object-contain shadow-2xl" initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ duration: 0.5, ease: EASE }} />
            <button className="absolute top-5 right-5 flex size-11 items-center justify-center rounded-full border hairline text-parchment" aria-label="Close" style={{ marginTop: "env(safe-area-inset-top)" }}>
              <X className="size-5" strokeWidth={1.25} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
