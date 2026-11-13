export function Monogram({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id="mono-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-gold-bright)" />
          <stop offset="0.5" stopColor="var(--color-gold)" />
          <stop offset="1" stopColor="var(--color-gold-deep)" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="url(#mono-gold)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="url(#mono-gold)" strokeWidth="0.4" opacity="0.6" />
      <text x="50" y="59" textAnchor="middle" fontFamily="var(--font-display)" fontSize="26" letterSpacing="2" fill="url(#mono-gold)">
        XXIV
      </text>
    </svg>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/70" />
      <span className="size-1 rotate-45 bg-gold" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/70" />
    </div>
  );
}
