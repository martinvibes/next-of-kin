"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Table2 } from "lucide-react";
import type { SnapshotMemory } from "@/domain/types";
import { formatUsd } from "@/domain/format";

/** Minimum plot height; the chart grows to fill its grid row. */
const H = 210;
const PAD = { top: 14, right: 12, bottom: 28, left: 36 };

function fmtDate(iso: string, withTime: boolean) {
  const d = new Date(iso);
  return withTime ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Readiness over time, built only from snapshot memories. One series, so the
 * title names it and there's no legend. Readiness changes only when a memory
 * is written, so it's drawn as steps.
 */
export function ReadinessChart({ snapshots }: { snapshots: SnapshotMemory[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  const [h, setH] = useState(H);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.max(240, Math.round(e.contentRect.width)));
      setH(Math.max(H, Math.round(e.contentRect.height)));
    });
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
    const ih = h - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + (pts.length === 1 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
    const y = (s: number) => PAD.top + ih - (s / 100) * ih;
    const xy = pts.map((p) => ({ x: x(new Date(p.ts).getTime()), y: y(p.score), p }));
    let d = `M ${xy[0].x} ${xy[0].y}`;
    for (let i = 1; i < xy.length; i++) d += ` H ${xy[i].x} V ${xy[i].y}`;
    return { xy, d, y };
  }, [pts, w, h]);

  const active = hover !== null && geo ? geo.xy[hover] : null;
  const last = pts[pts.length - 1];
  const first = pts[0];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!geo) return;
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geo.xy.length; i++) if (Math.abs(geo.xy[i].x - mx) < Math.abs(geo.xy[best].x - mx)) best = i;
    setHover(best);
  }

  return (
    <section className="card flex h-full min-w-0 flex-col overflow-hidden" aria-labelledby="chart-title">
      <div className="card-head">
        <div className="min-w-0">
          <h2 id="chart-title" className="card-title">
            <LineChart className="size-4" aria-hidden="true" />
            Readiness over time
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {last && first && pts.length > 1 && (
            <span className="t-num hidden text-[0.75rem] text-fg-3 sm:inline">
              {first.score}% → <span className="font-semibold text-mint">{last.score}%</span>
            </span>
          )}
          {pts.length > 0 && (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.75rem] text-fg-2 hover:bg-white/5 hover:text-fg" onClick={() => setTable((t) => !t)} aria-pressed={table}>
              {table ? <LineChart className="size-3.5" /> : <Table2 className="size-3.5" />}
              {table ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </div>

      <div ref={wrap} className="relative w-full min-w-0 flex-1 px-4 pt-4 pb-3" style={{ minHeight: H + 28 }}>
        {!geo ? (
          <div className="grid h-[190px] place-items-center rounded-xl border border-dashed border-line-2 text-center text-[0.8125rem] text-fg-3">
            <p className="max-w-xs px-4">The first snapshot is written after the first scan. Answer a question and watch the line climb.</p>
          </div>
        ) : table ? (
          <div className="max-h-[210px] overflow-auto">
            <table className="table">
              <caption className="sr-only">Readiness snapshots</caption>
              <thead className="sticky top-0 bg-panel">
                <tr>
                  <th className="!pl-1">When</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">Covered</th>
                  <th>Cause</th>
                </tr>
              </thead>
              <tbody>
                {[...pts].reverse().map((p) => (
                  <tr key={p.id}>
                    <td className="!pl-1 whitespace-nowrap text-fg-2">{fmtDate(p.ts, true)}</td>
                    <td className="t-num text-right font-semibold">{p.score}%</td>
                    <td className="t-num text-right whitespace-nowrap text-fg-2">{p.totalUsd > 0 ? `${formatUsd(p.coveredUsd)} / ${formatUsd(p.totalUsd)}` : `${p.covered}/${p.assets}`}</td>
                    <td className="text-fg-2">{p.cause ?? "scan"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <svg width={w} height={h} className="absolute top-4 left-4 block overflow-visible" role="img" aria-label={`Readiness over time, now ${last.score}%. ${pts.length} snapshots.`}>
              <defs>
                <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5ce9c6" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#5ce9c6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 50, 100].map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={w - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="rgba(255,255,255,0.07)" strokeDasharray={v === 0 ? undefined : "2 4"} />
                  <text x={PAD.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" className="t-num fill-fg-3 text-[10.5px]">
                    {v}%
                  </text>
                </g>
              ))}
              <text x={pts.length === 1 ? geo.xy[0].x : PAD.left} y={h - 6} textAnchor={pts.length === 1 ? "middle" : "start"} className="fill-fg-3 text-[10.5px]">
                {fmtDate(first.ts, sameDay)}
              </text>
              {pts.length > 1 && (
                <text x={w - PAD.right} y={h - 6} textAnchor="end" className="fill-fg-3 text-[10.5px]">
                  {fmtDate(last.ts, sameDay)}
                </text>
              )}

              <path d={`${geo.d} V ${geo.y(0)} H ${geo.xy[0].x} Z`} fill="url(#chart-area)" />
              <path d={geo.d} fill="none" stroke="#5ce9c6" strokeWidth={2} strokeLinejoin="round" />

              {active && <line x1={active.x} x2={active.x} y1={PAD.top} y2={h - PAD.bottom} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />}
              {geo.xy.map((q, i) => (
                <circle key={q.p.id} cx={q.x} cy={q.y} r={hover === i ? 5.5 : 4} fill="#0e1014" stroke="#5ce9c6" strokeWidth={2} />
              ))}
              <rect
                x={PAD.left - 10}
                y={0}
                width={Math.max(0, w - PAD.left - PAD.right + 20)}
                height={h}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                onPointerDown={onMove}
              />
            </svg>
            {active && (
              <div
                className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-lg border border-line-2 bg-panel-3 px-3 py-2 text-[0.75rem] shadow-[var(--shadow-pop)]"
                style={{ left: 16 + Math.min(Math.max(active.x - 110, 0), w - 220), top: Math.max(active.y - 70, 0) }}
                role="status"
              >
                <p className="t-num text-[0.95rem] font-semibold">{active.p.score}%</p>
                <p className="text-fg-2">{fmtDate(active.p.ts, true)}</p>
                <p className="mt-0.5 text-fg-3">{active.p.cause ?? "scan"}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
