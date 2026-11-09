"use client";

import { useEffect, useState } from "react";

/**
 * The readiness gauge: a 270° dial with fine ticks, in ink.
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
  const colors: Record<string, string> = { mint: "#191816", amber: "#b4690e", rose: "#c0352c", violet: "#5f5b54" };
  const c0 = colors[tone];

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
        stroke={i / 40 <= shown / 100 ? c0 : "rgba(25,24,22,0.16)"}
        strokeOpacity={i / 40 <= shown / 100 ? 0.55 : 1}
        strokeWidth={1}
        style={{ transition: "stroke 0.6s" }}
      />,
    );
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible" aria-hidden="true">
        {ticks}
        <path d={arc} fill="none" stroke="#efede8" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={c0}
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
  const bg: Record<string, string> = { mint: "bg-fg", violet: "bg-fg", sky: "bg-fg", amber: "bg-amber" };
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span className="text-fg-2">{label}</span>
        <span className="t-num font-medium text-fg">{Math.round(v)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
        <div className={`h-full rounded-full ${bg[tone]} transition-[width] duration-1000 ease-out`} style={{ width: `${v}%` }} />
      </div>
      {detail && <p className="mt-1 text-[0.72rem] text-fg-3">{detail}</p>}
    </div>
  );
}
