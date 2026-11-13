// Generates 24 original abstract artworks as SVG for the local demo (deterministic per day).

type Palette = { bg: [string, string]; ink: string[]; gold: string };

const PALETTES: Palette[] = [
  { bg: ["#0b0d14", "#1a1f2e"], ink: ["#2b3550", "#4a5a7a", "#c9b27c"], gold: "#d4b26a" },
  { bg: ["#120c0a", "#2a1a14"], ink: ["#5a2e22", "#8c4a32", "#e0c08a"], gold: "#e2bd72" },
  { bg: ["#0a1210", "#15241f"], ink: ["#1f3b33", "#3f6b5c", "#cdb98a"], gold: "#cfae63" },
  { bg: ["#100b14", "#221830"], ink: ["#3b2a52", "#6a4f86", "#e3c9a0"], gold: "#d8b878" },
  { bg: ["#0d0d0d", "#1e1c19"], ink: ["#3a3631", "#6e655a", "#efe3c8"], gold: "#c8a45c" },
  { bg: ["#07101a", "#0f2236"], ink: ["#1d3d5c", "#3f6f96", "#f1dfb4"], gold: "#e0bf75" },
];

const TITLES: Array<[string, string, string]> = [
  ["Nocturne in Gilt", "Isolde Varga", "A first light held against the longest nights of the year."],
  ["The First Frost", "Mateo Lind", "Breath on glass; the morning the garden turned to silver."],
  ["Orbit of Small Hours", "Céleste Amari", "Time measured not in minutes but in returning light."],
  ["Lantern Field", "Hugo Brandt", "A procession of warm windows across a winter valley."],
  ["Still Water, Gold Leaf", "Isolde Varga", "Reflection as a second, quieter painting."],
  ["Cathedral of Pines", "Noor Haddad", "Vertical silence, the architecture of a forest at dusk."],
  ["The Ember Hour", "Mateo Lind", "What remains of the fire when the room has gone quiet."],
  ["Constellation for a Child", "Céleste Amari", "A map of stars drawn to be wished upon."],
  ["Velvet Horizon", "Hugo Brandt", "The moment land and sky agree to the same colour."],
  ["A Bell Unrung", "Noor Haddad", "Anticipation, given a shape."],
  ["Winter Bloom", "Isolde Varga", "A flower that opens only when everything else has closed."],
  ["Gilded Tide", "Mateo Lind", "The sea, remembered in the colour of candlelight."],
  ["Monolith in Snow", "Céleste Amari", "Weight and lightness standing side by side."],
  ["The Quiet Arc", "Hugo Brandt", "Halfway through the season, a bridge between two halves."],
  ["Hearth", "Noor Haddad", "The circle that every home is built around."],
  ["Silver Procession", "Isolde Varga", "Footsteps of light moving through a dark street."],
  ["Comet Over Lake", "Mateo Lind", "A visitor that comes once, and is remembered for ever."],
  ["The Long Table", "Céleste Amari", "Room for everyone, and a place set for those far away."],
  ["Aurora Study", "Hugo Brandt", "Northern light, translated into a single gesture."],
  ["Garland", "Noor Haddad", "Repetition as celebration."],
  ["Solstice", "Isolde Varga", "The turning point: from here, the days grow longer."],
  ["Evening Choir", "Mateo Lind", "Many voices, one warm chord."],
  ["The Eve", "Céleste Amari", "Everything held, just before it is given."],
  ["Gift of Light", "Hugo Brandt", "The final door, and the first light of what comes next."],
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1200;
const H = 1500;
const f = (n: number) => n.toFixed(1);

function motif(style: number, r: () => number, p: Palette): string {
  const [a, b, c] = p.ink as [string, string, string];
  const g = p.gold;
  switch (style) {
    case 0: {
      // orbit: concentric rings around a gilded sun
      const cx = W * (0.35 + r() * 0.3), cy = H * (0.35 + r() * 0.2);
      let s = "";
      for (let i = 9; i >= 1; i--) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(i * 62 + r() * 20)}" fill="none" stroke="${i % 3 ? b : g}" stroke-opacity="${f(0.15 + i * 0.03)}" stroke-width="${f(1 + r() * 2)}"/>`;
      return s + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(90 + r() * 40)}" fill="url(#gold)"/>`;
    }
    case 1: {
      // horizon: layered hills under a moon
      let s = `<circle cx="${f(W * (0.3 + r() * 0.4))}" cy="${f(H * 0.3)}" r="${f(110 + r() * 50)}" fill="url(#gold)" opacity="0.92"/>`;
      [a, b, c, a].forEach((col, i) => {
        const y0 = H * (0.55 + i * 0.1);
        let d = `M0 ${f(y0)}`;
        for (let x = 0; x <= W; x += 100) d += ` Q${f(x + 50)} ${f(y0 - 40 - r() * 90)} ${f(x + 100)} ${f(y0 + r() * 30)}`;
        s += `<path d="${d} L${W} ${H} L0 ${H}Z" fill="${col}" opacity="${f(0.55 + i * 0.12)}"/>`;
      });
      return s;
    }
    case 2: {
      // constellation
      const pts = Array.from({ length: 16 }, () => [W * (0.1 + r() * 0.8), H * (0.1 + r() * 0.75)] as const);
      let s = "";
      for (let i = 1; i < pts.length; i++) if (r() > 0.3) s += `<line x1="${f(pts[i - 1]![0])}" y1="${f(pts[i - 1]![1])}" x2="${f(pts[i]![0])}" y2="${f(pts[i]![1])}" stroke="${g}" stroke-opacity="0.45" stroke-width="1.5"/>`;
      for (const [x, y] of pts) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(4 + r() * 10)}" fill="${g}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(30 + r() * 30)}" fill="${g}" opacity="0.06"/>`;
      return s;
    }
    case 3: {
      // monoliths
      let s = "";
      const n = 5 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const w = 70 + r() * 120, x = (W / n) * i + r() * 40, h = H * (0.3 + r() * 0.45);
        s += `<rect x="${f(x)}" y="${f(H * 0.88 - h)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" fill="${i % 3 === 1 ? "url(#gold)" : [a, b, c][i % 3]}" opacity="${f(0.55 + r() * 0.4)}"/>`;
      }
      return s + `<rect x="0" y="${f(H * 0.88)}" width="${W}" height="${f(H * 0.12)}" fill="${a}"/>`;
    }
    case 4: {
      // bloom: rotated petals
      const cx = W / 2, cy = H * 0.45;
      let s = "";
      const n = 10 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) s += `<ellipse cx="${cx}" cy="${f(cy - 190)}" rx="${f(60 + r() * 40)}" ry="${f(200 + r() * 60)}" fill="${i % 2 ? b : c}" opacity="0.22" transform="rotate(${f((360 / n) * i)} ${cx} ${cy})"/>`;
      return s + `<circle cx="${cx}" cy="${f(cy)}" r="${f(70 + r() * 30)}" fill="url(#gold)"/>`;
    }
    default: {
      // waves
      let s = "";
      for (let i = 0; i < 22; i++) {
        const y = H * 0.2 + i * 46;
        const amp = 30 + r() * 60;
        s += `<path d="M-50 ${f(y)} C${f(W * 0.25)} ${f(y - amp)} ${f(W * 0.5)} ${f(y + amp)} ${f(W + 50)} ${f(y - amp / 2)}" fill="none" stroke="${i % 5 === 0 ? g : [a, b, c][i % 3]}" stroke-width="${f(i % 5 === 0 ? 3 : 1.5 + r() * 2)}" stroke-opacity="${f(i % 5 === 0 ? 0.9 : 0.5 + r() * 0.4)}"/>`;
      }
      return s;
    }
  }
}

export function demoArtworkSvg(day: number): string {
  const r = rng(day * 7919);
  const p = PALETTES[(day * 5) % PALETTES.length]!;
  const style = (day - 1) % 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${p.bg[1]}"/><stop offset="1" stop-color="${p.bg[0]}"/></linearGradient>
<radialGradient id="gold" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff3d0"/><stop offset="0.45" stop-color="${p.gold}"/><stop offset="1" stop-color="#7a5a24"/></radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${day}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${motif(style, r, p)}
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}

export function demoArtworkMeta(day: number) {
  const [title, artist, description] = TITLES[day - 1]!;
  const p = PALETTES[(day * 5) % PALETTES.length]!;
  return {
    title,
    artist,
    description,
    story: `${artist} made this work for the twenty-four. Your print is a museum-grade giclée on 310 gsm cotton rag, hand-signed by the artist and numbered to match your edition.`,
    medium: "Archival pigment print on cotton rag",
    dimensions: "16 × 20 in (40.6 × 50.8 cm)",
    accent: p.gold,
    width: W,
    height: H,
  };
}
