"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SnapshotMemory } from "@/domain/types";
import { formatUsd } from "@/domain/format";

const H = 220;
const PAD = { top: 16, right: 16, bottom: 30, left: 38 };

function fmtDate(iso: string, withTime: boolean) {
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Readiness over time. One series, so no legend: the heading names it.
 * Readiness only changes when a memory is written, so it's drawn as steps.
 */
export function ReadinessChart({ snapshots }: { snapshots: SnapshotMemory[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => [...snapshots].sort((a, b) => a.ts.localeCompare(b.ts)), [snapshots]);
  const sameDay = pts.length > 1 && new Date(pts[pts.length - 1].ts).getTime() - new Date(pts[0].ts).getTime() < 36 * 3600_000;

  const geo = useMemo(() => {
    if (!pts.length) return null;
    const t0 = new Date(pts[0].ts).getTime();
    const t1 = Math.max(new Date(pts[pts.length - 1].ts).getTime(), t0 + 60_000);
    const iw = w - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + (pts.length === 1 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
    const y = (s: number) => PAD.top + ih - (s / 100) * ih;
    const xy = pts.map((p) => ({ x: x(new Date(p.ts).getTime()), y: y(p.score), p }));
    let d = `M ${xy[0].x} ${xy[0].y}`;
    for (let i = 1; i < xy.length; i++) d += ` H ${xy[i].x} V ${xy[i].y}`;
    return { xy, d, y, iw, ih };
  }, [pts, w]);

  const active = hover !== null && geo ? geo.xy[hover] : null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!geo) return;
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geo.xy.length; i++) if (Math.abs(geo.xy[i].x - mx) < Math.abs(geo.xy[best].x - mx)) best = i;
    setHover(best);
  }

  return (
    <section className="sheet min-w-0 p-6 sm:p-7" aria-labelledby="chart-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="chart-title" className="t-serif text-[1.35rem]">
          Readiness over time
        </h2>
        {pts.length > 0 && (
          <button type="button" className="link text-sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
            {table ? "Show chart" : "Show as table"}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-2">Each point is a snapshot kept on Walrus whenever the score moves.</p>

      <div ref={wrap} className="relative mt-5 w-full min-w-0">
        {!geo ? (
          <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-rule text-center text-sm text-ink-2">
            <p className="max-w-xs px-4">Your first snapshot is written after the first scan. Answer a question and watch the line climb.</p>
          </div>
        ) : table ? (
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Readiness snapshots</caption>
              <thead className="sticky top-0 bg-sheet text-ink-2">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 text-right font-medium">Score</th>
                  <th className="py-2 pr-3 text-right font-medium">Covered</th>
                  <th className="py-2 font-medium">Cause</th>
                </tr>
              </thead>
              <tbody>
                {[...pts].reverse().map((p) => (
                  <tr key={p.id} className="border-t border-rule-soft">
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{fmtDate(p.ts, true)}</td>
                    <td className="t-num py-2 pr-3 text-right font-semibold">{p.score}%</td>
                    <td className="t-num py-2 pr-3 text-right text-ink-2">{p.totalUsd > 0 ? `${formatUsd(p.coveredUsd)} / ${formatUsd(p.totalUsd)}` : `${p.covered}/${p.assets}`}</td>
                    <td className="py-2 text-ink-2">{p.cause ?? "scan"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <svg width={w} height={H} className="block overflow-visible" role="img" aria-label={`Readiness over time, now ${pts[pts.length - 1].score}%. ${pts.length} snapshots.`}>
              {[0, 50, 100].map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={w - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--rule-soft)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : "2 4"} />
                  <text x={PAD.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] t-num">
                    {v}%
                  </text>
                </g>
              ))}
              <text x={pts.length === 1 ? geo.xy[0].x : PAD.left} y={H - 8} textAnchor={pts.length === 1 ? "middle" : "start"} className="fill-ink-3 text-[11px]">
                {fmtDate(pts[0].ts, sameDay)}
              </text>
              {pts.length > 1 && (
                <text x={w - PAD.right} y={H - 8} textAnchor="end" className="fill-ink-3 text-[11px]">
                  {fmtDate(pts[pts.length - 1].ts, sameDay)}
                </text>
              )}

              <path d={`${geo.d} V ${geo.y(0)} H ${geo.xy[0].x} Z`} fill="var(--brass-wash)" opacity={0.7} />
              <path d={geo.d} fill="none" stroke="var(--brass)" strokeWidth={2} strokeLinejoin="round" />

              {active && <line x1={active.x} x2={active.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />}
              {geo.xy.map((q, i) => (
                <circle key={q.p.id} cx={q.x} cy={q.y} r={hover === i ? 6 : 4} fill="var(--sheet)" stroke="var(--brass)" strokeWidth={2} />
              ))}
              <rect
                x={PAD.left - 10}
                y={0}
                width={w - PAD.left - PAD.right + 20}
                height={H}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                onPointerDown={onMove}
              />
            </svg>
            {active && (
              <div
                className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-lg bg-ink px-3 py-2 text-[0.8125rem] text-sheet shadow-[var(--shadow-lift)]"
                style={{
                  left: Math.min(Math.max(active.x - 110, 0), w - 220),
                  top: Math.max(active.y - 78, -8),
                }}
                role="status"
              >
                <p className="t-num text-base font-semibold">{active.p.score}%</p>
                <p className="opacity-80">{fmtDate(active.p.ts, true)}</p>
                <p className="mt-0.5 opacity-80">{active.p.cause ?? "scan"}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
