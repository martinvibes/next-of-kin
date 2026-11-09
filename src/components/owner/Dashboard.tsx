"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingDown, TrendingUp, X } from "lucide-react";
import type { StatusResponse } from "@/lib/api-types";
import { ApiFailure, setOwnerSecret } from "@/lib/client";
import { countdown, useNow } from "@/lib/time";
import { useOwner, type OwnerCtx } from "./useOwner";
import { CheckinButton, Shell, viewFromHash, type View } from "./Shell";
import { Overview } from "./Overview";
import { AgentView } from "./QuestionArea";
import { AssetsTable } from "./Ledger";
import { WalletsView } from "./WalletsPanel";
import { LetterView } from "./LetterPanel";
import { MemoryView } from "./MemoryFeed";

export interface Checkin {
  busy: boolean;
  done: boolean;
  run: () => void;
  left: string | null;
  leftMs: number | null;
}

function useCheckin(o: OwnerCtx): Checkin {
  const sw = o.state?.switch ?? null;
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const target = sw?.phase === "alive" ? sw.dueAt : sw?.phase === "overdue" ? sw.releaseAt : null;
  const leftMs = target ? new Date(target).getTime() - now : null;

  // When a boundary passes, ask the server for the new phase.
  const crossed = leftMs !== null && leftMs <= 0;
  useEffect(() => {
    if (crossed) o.loadState().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossed]);

  const run = useCallback(async () => {
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
  }, [o]);

  return { busy, done, run, leftMs, left: leftMs !== null ? countdown(leftMs) : null };
}

export function Dashboard({ cryptoKey, status, onLock }: { cryptoKey: CryptoKey; status: StatusResponse; onLock: () => void }) {
  const o = useOwner(cryptoKey, status);
  const ci = useCheckin(o);
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    setView(viewFromHash());
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((v: View) => {
    window.history.replaceState(null, "", v === "overview" ? window.location.pathname : `#${v}`);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const sw = o.state?.switch ?? null;
  const counts = {
    agent: o.scan?.questions.length ?? 0,
    wallets: o.state?.state.wallets.length ?? 0,
    memory: o.state?.state.counts.total ?? 0,
  };

  return (
    <Shell
      view={view}
      onView={go}
      status={status}
      sw={sw}
      counts={counts}
      ownerName={o.dec?.ownerName ?? null}
      onLock={() => {
        setOwnerSecret(null);
        onLock();
      }}
      topRight={<CheckinButton sw={sw} busy={ci.busy} done={ci.done} onClick={ci.run} left={ci.left} />}
    >
      {o.error && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-rose/25 bg-rose-wash px-4 py-3 text-sm text-rose animate-rise" role="alert">
          <p>{o.error}</p>
          <button type="button" className="shrink-0 opacity-80 hover:opacity-100" onClick={() => o.setError(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div key={view} className="animate-rise">
        {view === "overview" && <Overview o={o} go={go} ci={ci} />}
        {view === "agent" && <AgentView o={o} />}
        {view === "assets" && <AssetsTable o={o} />}
        {view === "wallets" && <WalletsView o={o} />}
        {view === "letter" && <LetterView o={o} />}
        {view === "memory" && <MemoryView o={o} />}
      </div>

      <GainToast o={o} />
    </Shell>
  );
}

/** A small toast whenever readiness moves, so every answer visibly pays off. */
function GainToast({ o }: { o: OwnerCtx }) {
  const [shown, setShown] = useState<{ delta: number; score: number } | null>(null);
  useEffect(() => {
    if (!o.lastGain || !o.scan) return;
    setShown({ delta: o.lastGain.delta, score: o.scan.readiness.score });
    const t = setTimeout(() => setShown(null), 3800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.lastGain]);
  if (!shown) return null;
  const up = shown.delta >= 0;
  return (
    <div className="no-print fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-xl border border-line-2 bg-panel-2 px-4 py-3 shadow-[var(--shadow-pop)] animate-rise sm:right-6 sm:bottom-6" role="status">
      <span className={`grid size-8 place-items-center rounded-lg ${up ? "bg-mint-wash text-mint" : "bg-amber-wash text-amber"}`}>{up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}</span>
      <div>
        <p className="text-sm font-semibold">
          Readiness {up ? "+" : "−"}
          {Math.abs(shown.delta)} points
        </p>
        <p className="text-[0.75rem] text-fg-3">Now {shown.score}%. Saved as a snapshot memory.</p>
      </div>
    </div>
  );
}
