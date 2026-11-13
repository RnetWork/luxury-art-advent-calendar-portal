"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { prepareArtworkUpload, saveArtwork } from "@/server/actions/admin";

type Initial = {
  title: string;
  artist: string;
  medium: string;
  dimensions: string;
  year: number | null;
  description: string;
  story: string;
  printSku: string;
  accent: string | null;
  published: boolean;
  imageUrl: string | null;
};

const input = "w-full rounded-lg border hairline bg-ink-900 px-3 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-gold focus:outline-none";

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth || 1200, height: img.naturalHeight || 1500 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ArtworkForm({ day, initial }: { day: number; initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.imageUrl);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Initial>(k: K, val: Initial[K]) => setV((s) => ({ ...s, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      let image = null;
      if (file) {
        const prep = await prepareArtworkUpload(file.type);
        if (!prep.ok) return setStatus({ tone: "err", text: prep.error });
        const up = await fetch(prep.data.url, { method: prep.data.method, headers: prep.data.headers, body: file });
        if (!up.ok) return setStatus({ tone: "err", text: `Upload failed (${up.status})` });
        image = { key: prep.data.key, type: file.type, ...(await imageSize(file)) };
      }
      const res = await saveArtwork({ day, ...v, image });
      if (!res.ok) return setStatus({ tone: "err", text: res.error });
      setFile(null);
      setStatus({ tone: "ok", text: "Saved" });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="space-y-3">
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border hairline bg-ink-850">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview / guarded route */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span className="text-xs text-faint">No image yet</span>}
        </div>
        <label className="btn-ghost w-full cursor-pointer">
          {preview ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }}
          />
        </label>
        <p className="text-xs text-faint">JPEG, PNG, WebP, AVIF or SVG. Goes straight to private storage; collectors only receive it after the unlock.</p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <input className={input} value={v.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <Field label="Artist">
            <input className={input} value={v.artist} onChange={(e) => set("artist", e.target.value)} required />
          </Field>
          <Field label="Medium">
            <input className={input} value={v.medium} onChange={(e) => set("medium", e.target.value)} />
          </Field>
          <Field label="Print size">
            <input className={input} value={v.dimensions} onChange={(e) => set("dimensions", e.target.value)} />
          </Field>
          <Field label="Year">
            <input className={input} type="number" value={v.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Print SKU (sent to the lab)">
            <input className={input} value={v.printSku} onChange={(e) => set("printSku", e.target.value)} required />
          </Field>
        </div>
        <Field label="Short description (shown under the title)">
          <textarea className={`${input} min-h-20`} value={v.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="The story behind the work">
          <textarea className={`${input} min-h-32`} value={v.story} onChange={(e) => set("story", e.target.value)} />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border hairline p-4">
          <input type="checkbox" className="size-4 accent-[var(--color-gold)]" checked={v.published} onChange={(e) => set("published", e.target.checked)} />
          <span className="text-sm">
            <span className="text-ivory">Published</span>
            <span className="block text-xs text-muted">Ready to reveal on its day. Unpublished doors show “being prepared” after the unlock time.</span>
          </span>
        </label>
        <div className="flex items-center gap-4">
          <button className="btn-gold" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          {status && (
            <p role="status" className={`text-sm ${status.tone === "ok" ? "text-sage" : "text-garnet"}`}>
              {status.text}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[0.68rem] uppercase tracking-[0.18em] text-faint">{label}</span>
      {children}
    </label>
  );
}
