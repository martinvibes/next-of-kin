"use client";

import { useEffect, useId, useState } from "react";

/**
 * The readiness gauge: a 270° instrument dial with ticks.
 * The arc animates from its previous value, so a gain is visible.
 */
export function Ring({
  value,
  size = 180,
  stroke = 12,
  tone = "mint",
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "mint" | "amber" | "rose" | "violet";
  label: string;
  children?: React.ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(t);
  }, [value]);

  const r = (size - stroke) / 2 - 6;
  const c = size / 2;
  const sweep = 270;
  const len = (2 * Math.PI * r * sweep) / 360;
  const start = 135; // degrees, measured clockwise from +x
  const arc = describeArc(c, c, r, start, start + sweep);
  const colors: Record<string, [string, string]> = {
    mint: ["#5ce9c6", "#8af2d8"],
    amber: ["#f6b956", "#ffd58a"],
    rose: ["#ff6f86", "#ff9aab"],
    violet: ["#a99bff", "#c9c0ff"],
  };
  const [c0, c1] = colors[tone];

  const ticks = [];
  for (let i = 0; i <= 40; i++) {
    const a = ((start + (sweep * i) / 40) * Math.PI) / 180;
    const r1 = r + stroke / 2 + 5;
    const r2 = r1 + (i % 10 === 0 ? 5 : 2.5);
    ticks.push(
      <line
        key={i}
        x1={round(c + r1 * Math.cos(a))}
        y1={round(c + r1 * Math.sin(a))}
        x2={round(c + r2 * Math.cos(a))}
        y2={round(c + r2 * Math.sin(a))}
        stroke={i / 40 <= shown / 100 ? c0 : "rgba(255,255,255,0.14)"}
        strokeOpacity={i / 40 <= shown / 100 ? 0.7 : 1}
        strokeWidth={1}
        style={{ transition: "stroke 0.6s" }}
      />,
    );
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`rg-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={c0} />
            <stop offset="1" stopColor={c1} />
          </linearGradient>
          <filter id={`rf-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {ticks}
        <path d={arc} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={`url(#rg-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - shown / 100)}
          opacity={0.35}
          filter={`url(#rf-${id})`}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.7,0.1,1)" }}
        />
        <path
          d={arc}
          fill="none"
          stroke={`url(#rg-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.7,0.1,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(a)), y: round(cy + r * Math.sin(a)) };
}

/** Node and browsers disagree in the last float digits of Math.cos; round so hydration matches. */
function round(n: number) {
  return Math.round(n * 100) / 100;
}

function describeArc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** A thin horizontal meter for where / how / who. */
export function Meter({ value, tone = "mint", label, detail }: { value: number; tone?: "mint" | "violet" | "sky" | "amber"; label: string; detail?: string }) {
  const bg: Record<string, string> = { mint: "bg-mint", violet: "bg-violet", sky: "bg-sky", amber: "bg-amber" };
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span className="text-fg-2">{label}</span>
        <span className="t-num font-medium text-fg">{Math.round(v)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
        <div className={`h-full rounded-full ${bg[tone]} transition-[width] duration-1000 ease-out`} style={{ width: `${v}%` }} />
      </div>
      {detail && <p className="mt-1 text-[0.72rem] text-fg-3">{detail}</p>}
    </div>
  );
}
