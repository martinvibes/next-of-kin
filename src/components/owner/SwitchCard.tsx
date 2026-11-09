"use client";

import { useEffect, useState } from "react";
import { formatInterval, relativeTime } from "@/domain/format";
import type { SwitchStatus } from "@/domain/types";
import { ApiFailure } from "@/lib/client";
import type { OwnerCtx } from "./useOwner";

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "2d 4h", "3h 12m", "4m 09s" */
export function countdown(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

const PHASE: Record<SwitchStatus["phase"], { label: string; cls: string }> = {
  setup: { label: "Not set up", cls: "bg-sheet-2 text-ink-2" },
  alive: { label: "Sealed", cls: "bg-moss-wash text-moss" },
  overdue: { label: "Overdue", cls: "bg-amber-wash text-amber" },
  released: { label: "Released to heir", cls: "bg-claret-wash text-claret" },
};

export function SwitchCard({ o }: { o: OwnerCtx }) {
  const sw = o.state?.switch ?? null;
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const target = sw?.phase === "alive" ? sw.dueAt : sw?.phase === "overdue" ? sw.releaseAt : null;
  const left = target ? new Date(target).getTime() - now : null;

  // When a boundary passes, ask the server for the new phase.
  useEffect(() => {
    if (left !== null && left <= 0 && left > -2500) o.loadState().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left !== null && left <= 0]);

  async function alive() {
    setBusy(true);
    try {
      await o.checkin();
      setDone(true);
      setTimeout(() => setDone(false), 2600);
    } catch (e) {
      o.setError(e instanceof ApiFailure ? e.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  }

  const phase = sw ? PHASE[sw.phase] : null;
  const hasSui = !!o.state?.state.wallets.some((w) => w.chain === "sui");
  const heir = o.dec?.heirName || "your heir";
  const total = sw ? (sw.phase === "overdue" ? sw.graceSec : sw.intervalSec) * 1000 : 1;
  const frac = left !== null ? Math.min(1, Math.max(0, left / total)) : 0;

  return (
    <section className="sheet flex min-w-0 flex-col p-6 sm:p-7" aria-labelledby="switch-title">
      <div className="flex items-start justify-between gap-4">
        <h2 id="switch-title" className="t-serif text-[1.35rem]">
          The switch
        </h2>
        {phase && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${phase.cls}`}>{phase.label}</span>}
      </div>

      {!sw ? (
        <p className="mt-6 text-ink-2 animate-pulse-soft">Reading…</p>
      ) : sw.phase === "released" ? (
        <div className="mt-5 space-y-3">
          <p className="t-serif text-[1.15rem] leading-snug">
            Your letter has been released to {heir}. Check in to seal it again.
          </p>
          <p className="text-sm text-ink-2">Every release is written to Walrus as an audit memory.</p>
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm text-ink-2">{sw.phase === "overdue" ? `Released to ${heir} in` : `Opens for ${heir} in`}</p>
          <p className={`t-display t-num mt-1 text-[2.6rem] leading-none ${sw.phase === "overdue" ? "text-amber" : ""}`} aria-live="off">
            {left !== null ? countdown(left) : "—"}
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sheet-2" aria-hidden="true">
            <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${sw.phase === "overdue" ? "bg-amber" : "bg-ink"}`} style={{ width: `${frac * 100}%` }} />
          </div>
          {sw.phase === "overdue" && <p className="mt-3 text-sm text-amber">You missed a check-in. A grace period has started.</p>}
        </>
      )}

      {sw && (
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule-soft pt-4 text-sm">
          <div>
            <dt className="text-ink-3">Last sign of life</dt>
            <dd className="mt-0.5">
              {sw.lastAlive ? relativeTime(sw.lastAlive, new Date(now).toISOString()) : "—"}
              <span className="block text-xs text-ink-2">
                {sw.lastAliveSource === "onchain" ? "an on-chain transaction, seen via Tatum" : sw.lastAliveSource === "checkin" ? "a check-in" : sw.lastAliveSource === "profile" ? "vault setup" : ""}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Check-in every</dt>
            <dd className="mt-0.5">
              {formatInterval(sw.intervalSec)}
              {o.status.demoInterval && <span className="ml-1.5 rounded bg-amber-wash px-1.5 py-0.5 text-[0.7rem] font-semibold text-amber">demo</span>}
              <span className="block text-xs text-ink-2">plus {formatInterval(sw.graceSec)} grace</span>
            </dd>
          </div>
        </dl>
      )}
      {sw && !sw.onchainAvailable && (
        <p className="mt-3 text-xs text-ink-2">
          {hasSui ? "Couldn't read on-chain activity just now, so only check-ins count." : "Add a Sui wallet and its outgoing transactions count as check-ins too."}
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-6">
        <button type="button" className="btn btn-primary" onClick={alive} disabled={busy || !sw || sw.phase === "setup"}>
          {busy ? "Checking in…" : done ? "Checked in" : "I'm still here"}
        </button>
        {hasSui && <p className="text-xs text-ink-2">Any transaction from your Sui wallets also counts.</p>}
      </div>
    </section>
  );
}
