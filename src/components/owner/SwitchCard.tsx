"use client";

import { HeartPulse } from "lucide-react";
import { formatInterval, relativeTime } from "@/domain/format";
import type { SwitchStatus } from "@/domain/types";
import { countdown, useNow } from "@/lib/time";
import type { OwnerCtx } from "./useOwner";
import type { Checkin } from "./Dashboard";

const PHASE: Record<SwitchStatus["phase"], { label: string; cls: string }> = {
  setup: { label: "Not set up", cls: "pill-muted" },
  alive: { label: "Sealed", cls: "pill-mint" },
  overdue: { label: "Overdue", cls: "pill-amber" },
  released: { label: "Released", cls: "pill-rose" },
};

const SOURCE: Record<string, string> = {
  onchain: "On-chain transaction, seen via Tatum",
  checkin: "Check-in",
  profile: "Vault setup",
};

/** The dead man's switch, drawn as a heartbeat: real beats, then a flat line to the release. */
export function LifeCard({ o, ci, className = "" }: { o: OwnerCtx; ci: Checkin; className?: string }) {
  const sw = o.state?.switch ?? null;
  const now = useNow();
  const heir = o.dec?.heirName || "your heir";
  const hasSui = !!o.state?.state.wallets.some((w) => w.chain === "sui");
  const beats = (o.state?.memories ?? []).filter((m) => m.memory.kind === "checkin").map((m) => Date.parse(m.memory.ts));
  if (sw?.lastAlive) beats.push(Date.parse(sw.lastAlive));

  return (
    <section className={`card flex min-w-0 flex-col overflow-hidden ${sw?.phase === "overdue" ? "glow-amber" : sw?.phase === "released" ? "glow-rose" : ""} ${className}`} aria-labelledby="life-title">
      <div className="card-head">
        <h2 id="life-title" className="card-title">
          <HeartPulse className="size-4" aria-hidden="true" />
          Proof of life
        </h2>
        {sw && <span className={`pill ${PHASE[sw.phase].cls}`}>{PHASE[sw.phase].label}</span>}
      </div>

      <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
        {!sw ? (
          <div className="space-y-3">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-10 w-40" />
            <div className="skeleton h-14 w-full" />
          </div>
        ) : sw.phase === "released" ? (
          <>
            <p className="text-[0.8125rem] text-fg-3">Status</p>
            <p className="mt-1 text-[1.15rem] leading-snug font-semibold">Your letter is open to {heir}.</p>
            <p className="mt-1 text-[0.8125rem] text-fg-2">Check in to seal it again. The release was recorded as a memory.</p>
          </>
        ) : (
          <>
            <p className="text-[0.8125rem] text-fg-3">{sw.phase === "overdue" ? `Opens for ${heir} in` : `Next check-in due in`}</p>
            <p className={`t-num mt-0.5 text-[2.1rem] leading-none font-semibold tracking-[-0.03em] ${sw.phase === "overdue" ? "text-amber" : ""}`}>{ci.left ?? "—"}</p>
          </>
        )}

        {sw && sw.phase !== "setup" && <LifeLine sw={sw} now={now} beats={beats} />}

        {sw && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[0.8125rem]">
            <div className="min-w-0">
              <dt className="text-fg-3">Last sign of life</dt>
              <dd className="mt-0.5 font-medium">{sw.lastAlive ? relativeTime(sw.lastAlive, new Date(now).toISOString()) : "—"}</dd>
              <dd className="text-[0.72rem] text-fg-3">{SOURCE[sw.lastAliveSource ?? ""] ?? ""}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-fg-3">Check-in every</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                {formatInterval(sw.intervalSec)}
                {o.status.demoInterval && <span className="pill pill-amber !h-5 !text-[0.65rem]">demo</span>}
              </dd>
              <dd className="text-[0.72rem] text-fg-3">then {formatInterval(sw.graceSec)} grace</dd>
            </div>
          </dl>
        )}
        <p className="mt-auto pt-4 text-[0.75rem] text-fg-3">
          {sw && !sw.onchainAvailable && hasSui
            ? "Couldn't read on-chain activity just now, so only check-ins count."
            : hasSui
              ? "Any outgoing transaction from your Sui wallets counts as a check-in."
              : "Add a Sui wallet and its transactions count as check-ins too."}
        </p>
      </div>
    </section>
  );
}

function LifeLine({ sw, now, beats }: { sw: SwitchStatus; now: number; beats: number[] }) {
  if (!sw.lastAlive || !sw.dueAt || !sw.releaseAt) return null;
  const alive = Date.parse(sw.lastAlive);
  const due = Date.parse(sw.dueAt);
  const release = Date.parse(sw.releaseAt);
  const span = release - alive;
  const t0 = alive - span * 0.22;
  const t1 = release;
  const W = 600;
  const H = 64;
  const mid = 38;
  const x = (t: number) => ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * W;
  const nowX = x(now);
  const dueX = x(due);
  const released = sw.phase === "released";

  const xs: number[] = [];
  for (const bx of beats.filter((b) => b >= t0 && b <= now).map((b) => Math.round(x(b))).sort((a, b) => a - b)) {
    if (bx >= 8 && (xs.length === 0 || bx - xs[xs.length - 1] >= 20)) xs.push(bx);
  }
  let d = `M 0 ${mid}`;
  let end = 0;
  for (const bx of xs) {
    d += ` L ${bx - 8} ${mid} L ${bx - 4} ${mid - 6} L ${bx} ${mid - 28} L ${bx + 4} ${mid + 16} L ${bx + 8} ${mid - 4} L ${bx + 11} ${mid}`;
    end = bx + 11;
  }
  const head = Math.max(nowX, end);
  d += ` L ${head} ${mid}`;

  return (
    <div className="mt-4" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-16 w-full overflow-visible">
        <defs>
          <linearGradient id="beat-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#5ce9c6" stopOpacity="0.15" />
            <stop offset="0.3" stopColor="#5ce9c6" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect x={dueX} y={6} width={Math.max(0, W - dueX)} height={H - 12} rx={6} fill="rgba(246,185,86,0.07)" />
        <line x1={dueX} x2={dueX} y1={6} y2={H - 6} stroke="rgba(246,185,86,0.45)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke={released ? "#ff6f86" : "url(#beat-fade)"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {!released && <line x1={head} x2={W} y1={mid} y2={mid} stroke="rgba(255,255,255,0.18)" strokeWidth={2} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="relative -mt-16 h-16">
        {!released && <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint animate-beat" style={{ left: `${(head / W) * 100}%`, top: `${(mid / H) * 100}%` }} />}
      </div>
      <div className="relative mt-1 h-4 text-[0.68rem] text-fg-3">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(x(alive) / W) * 100}%` }}>
          Last beat
        </span>
        <span className="absolute -translate-x-1/2 text-amber/80" style={{ left: `${(dueX / W) * 100}%` }}>
          Due
        </span>
        <span className="absolute right-0">Opens</span>
      </div>
    </div>
  );
}

export { countdown };
