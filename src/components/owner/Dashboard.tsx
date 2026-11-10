"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import type { StatusResponse } from "@/lib/api-types";
import { errorText, isRetryable, setOwnerSecret } from "@/lib/client";
import { toast } from "@/components/ui/Toast";
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

  const run = useCallback(
    async function again() {
      setBusy(true);
      try {
        const r = await o.checkin();
        setDone(true);
        setTimeout(() => setDone(false), 2600);
        const due = r.switch.dueAt ? countdown(new Date(r.switch.dueAt).getTime() - Date.now()) : null;
        toast.success("Checked in", `${due ? `The timer restarts: next check-in due in ${due}.` : "The timer restarts now."} ${o.savedTo}`);
      } catch (e) {
        toast.error(
          "Check-in didn't go through",
          `${errorText(e, "The server didn't confirm it.")} Your heir's letter stays sealed until the timer actually runs out.`,
          isRetryable(e) ? { label: "Try again", onClick: () => void again() } : undefined,
        );
      } finally {
        setBusy(false);
      }
    },
    [o],
  );

  return { busy, done, run, leftMs, left: leftMs !== null ? countdown(leftMs) : null };
}

export function Dashboard({ cryptoKey, status, onLock }: { cryptoKey: CryptoKey; status: StatusResponse; onLock: () => void }) {
  const o = useOwner(cryptoKey, status);
  const ci = useCheckin(o);
  const [view, setView] = useState<View>("home");

  useEffect(() => {
    setView(viewFromHash());
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((v: View) => {
    window.history.replaceState(null, "", v === "home" ? window.location.pathname : `#${v}`);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const sw = o.state?.switch ?? null;
  const counts = {
    questions: o.scan?.questions.length ?? 0,
    wallets: o.state?.state.wallets.length ?? 0,
  };

  return (
    <Shell
      view={view}
      onView={go}
      status={status}
      counts={counts}
      ownerName={o.dec?.ownerName ?? null}
      onLock={() => {
        setOwnerSecret(null);
        onLock();
      }}
      topRight={<CheckinButton sw={sw} busy={ci.busy} done={ci.done} onClick={ci.run} left={ci.left} />}
    >
      {o.error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[#f1d5d0] bg-rose-wash px-4 py-3 text-sm text-rose animate-rise" role="alert">
          <p className="min-w-0 flex-1 basis-64">{o.error}</p>
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" className="btn btn-secondary btn-sm cursor-pointer" onClick={() => void o.reload()} disabled={o.scanning}>
              <RefreshCw className={o.scanning ? "animate-spin" : ""} /> {o.scanning ? "Trying…" : "Try again"}
            </button>
            <button type="button" className="grid size-8 cursor-pointer place-items-center rounded-md opacity-80 hover:opacity-100" onClick={() => o.setError(null)} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </span>
        </div>
      )}

      <div key={view} className="view-enter">
        {view === "home" && <Overview o={o} go={go} ci={ci} />}
        {view === "questions" && <AgentView o={o} />}
        {view === "wallets" && (
          <div className="space-y-10">
            <AssetsTable o={o} />
            <WalletsView o={o} />
          </div>
        )}
        {view === "letter" && <LetterView o={o} />}
        {view === "activity" && <MemoryView o={o} />}
      </div>
    </Shell>
  );
}
