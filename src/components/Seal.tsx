/**
 * The seal — a guilloché rosette, the engraved pattern found on banknotes,
 * share certificates and deeds. Generated mathematically; each curve starts at
 * twelve o'clock so a stroke-dash reveal "inks" the seal clockwise in
 * proportion to heir readiness.
 */
import type { ReactNode } from "react";

type Curve = { d: string; w: number };

const C = 100;
const TAU = Math.PI * 2;

function ring(
  samples: number,
  radius: (t: number) => number,
): string {
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * TAU - Math.PI / 2;
    const r = radius(t + Math.PI / 2);
    const x = C + r * Math.cos(t);
    const y = C + r * Math.sin(t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

function build(): { bands: Curve[]; rules: number[] } {
  const bands: Curve[] = [];
  // Outer braid: 12 phase-shifted sinusoid rings weave a rope-like band.
  for (let k = 0; k < 12; k++) {
    const ph = (k / 12) * TAU;
    bands.push({ d: ring(720, (t) => 86 + 5.2 * Math.sin(18 * t + ph)), w: 0.42 });
  }
  // Middle rosette: two frequencies beat against each other to form petals.
  for (let k = 0; k < 9; k++) {
    const ph = (k / 9) * TAU;
    bands.push({
      d: ring(900, (t) => 66 + 8.5 * Math.sin(10 * t + ph) * Math.cos(2 * t) + 2.4 * Math.sin(30 * t - ph)),
      w: 0.38,
    });
  }
  // Inner lace: tight, fine.
  for (let k = 0; k < 6; k++) {
    const ph = (k / 6) * TAU;
    bands.push({ d: ring(720, (t) => 50 + 2.6 * Math.sin(24 * t + ph)), w: 0.34 });
  }
  return { bands, rules: [93.5, 78.5, 56.5, 45.5] };
}

const GEOMETRY = build();

export interface SealProps {
  /** 0..100 — how much of the seal is inked. Omit for a fully inked seal. */
  value?: number;
  size?: number | string;
  tone?: "brass" | "ink" | "moss" | "claret";
  /** draw the ink-in animation on mount */
  animate?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}

const TONES = {
  brass: "var(--brass)",
  ink: "var(--ink)",
  moss: "var(--moss)",
  claret: "var(--claret)",
} as const;

export function Seal({ value, size = 240, tone = "brass", animate = true, className, children, label }: SealProps) {
  const pct = value === undefined ? 100 : Math.max(0, Math.min(100, value));
  const color = TONES[tone];
  return (
    <div
      className={`relative inline-grid place-items-center ${className ?? ""}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* the un-inked engraving, faint like a blind emboss */}
        <g fill="none" stroke={color} opacity={0.16}>
          {GEOMETRY.bands.map((c, i) => (
            <path key={i} d={c.d} strokeWidth={c.w} />
          ))}
        </g>
        {/* the inked part */}
        <g fill="none" stroke={color} strokeLinecap="round">
          {GEOMETRY.bands.map((c, i) => (
            <path
              key={i}
              d={c.d}
              strokeWidth={c.w + 0.12}
              pathLength={100}
              strokeDasharray="100 100"
              strokeDashoffset={100 - pct}
              style={{
                transition: "stroke-dashoffset 1100ms cubic-bezier(.3,.7,.2,1)",
                animation: animate ? `nok-ink 1600ms cubic-bezier(.3,.7,.2,1) ${80 + (i % 9) * 22}ms both` : undefined,
              }}
            />
          ))}
        </g>
        <g fill="none" stroke={color}>
          {GEOMETRY.rules.map((r, i) => (
            <circle key={r} cx={C} cy={C} r={r} strokeWidth={i === 0 ? 0.7 : 0.45} opacity={i === 0 ? 0.55 : 0.4} />
          ))}
        </g>
      </svg>
      {children ? <div className="relative z-10 grid place-items-center text-center">{children}</div> : null}
    </div>
  );
}

/** A small seal glyph used as the brand mark. */
export function SealMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        {GEOMETRY.bands
          .filter((_, i) => i % 3 === 0)
          .map((c, i) => (
            <path key={i} d={c.d} strokeWidth={2.2} />
          ))}
        <circle cx={C} cy={C} r={93.5} strokeWidth={5} />
      </g>
      <circle cx={C} cy={C} r={30} fill="currentColor" />
    </svg>
  );
}
