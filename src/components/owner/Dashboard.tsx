"use client";

import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Seal } from "@/components/Seal";
import { formatUsd } from "@/domain/format";
import type { StatusResponse } from "@/lib/api-types";
import { setOwnerSecret } from "@/lib/client";
import { useOwner, type OwnerCtx } from "./useOwner";
import { QuestionArea } from "./QuestionArea";
import { SwitchCard } from "./SwitchCard";
import { ReadinessChart } from "./ReadinessChart";
import { Ledger } from "./Ledger";
import { WalletsPanel } from "./WalletsPanel";
import { LetterPanel } from "./LetterPanel";

export function Dashboard({ cryptoKey, status, onLock }: { cryptoKey: CryptoKey; status: StatusResponse; onLock: () => void }) {
  const o = useOwner(cryptoKey, status);
  return (
    <>
      <SiteHeader
        current="owner"
        right={
          <button
            type="button"
            className="ml-1 rounded-full px-3 py-1.5 text-ink-2 hover:text-ink"
            onClick={() => {
              setOwnerSecret(null);
              onLock();
            }}
          >
            Lock
          </button>
        }
      />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {o.error && (
          <p className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-claret-wash px-4 py-3 text-sm text-claret" role="alert">
            {o.error}
            <button type="button" className="link shrink-0" onClick={() => o.setError(null)}>
              Dismiss
            </button>
          </p>
        )}

        <section className="grid items-start gap-10 pt-4 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14" aria-label="Readiness and next question">
          <ReadinessPanel o={o} />
          <QuestionArea o={o} />
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" aria-label="Switch and history">
          <SwitchCard o={o} />
          <ReadinessChart snapshots={o.scan?.snapshots ?? o.state?.state.snapshots ?? []} />
        </section>

        <Ledger o={o} />

        <section className="mt-20 grid items-start gap-6 lg:grid-cols-2" aria-label="Wallets and letter">
          <WalletsPanel o={o} />
          <LetterPanel o={o} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function ReadinessPanel({ o }: { o: OwnerCtx }) {
  const r = o.scan?.readiness;
  const score = r?.score ?? 0;
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    if (!o.lastGain) return;
    setFlash(o.lastGain.delta);
    const t = setTimeout(() => setFlash(null), 3600);
    return () => clearTimeout(t);
  }, [o.lastGain]);

  const remaining = o.scan?.questions.length ?? 0;
  return (
    <div className="flex flex-col items-center text-center lg:sticky lg:top-6">
      <div className="relative">
        <Seal size={300} value={r ? score : 0} tone={score >= 90 ? "moss" : "brass"} label={`Heir readiness ${score}%`}>
          <span className="t-display t-num text-[4.2rem] leading-none" aria-hidden="true">
            {r ? score : "—"}
            <span className="text-[1.8rem] align-top">%</span>
          </span>
          <span className="mt-2 text-sm text-ink-2">heir readiness</span>
        </Seal>
        {flash !== null && (
          <span
            className={`absolute top-6 -right-2 rounded-full px-3 py-1 text-sm font-semibold shadow-[var(--shadow-lift)] animate-rise ${flash >= 0 ? "bg-moss text-white" : "bg-claret text-white"}`}
            role="status"
          >
            {flash >= 0 ? "+" : "−"}
            {Math.abs(flash)} points
          </span>
        )}
      </div>

      {r ? (
        <p className="t-serif mt-6 max-w-sm text-[1.15rem] leading-snug text-balance">
          {r.basis === "usd" ? (
            <>
              Your heir could recover <strong className="font-bold">{formatUsd(r.coveredUsd)}</strong> of {formatUsd(r.totalUsd)} today.
            </>
          ) : r.assets === 0 ? (
            <>Add a wallet and your heir&rsquo;s readiness starts counting.</>
          ) : (
            <>
              {r.covered} of {r.assets} assets are covered.
            </>
          )}
        </p>
      ) : (
        <p className="mt-6 text-ink-2 animate-pulse-soft">Reading your wallets through Tatum…</p>
      )}
      {r && remaining > 0 && (
        <p className="mt-2 text-sm text-ink-2">
          {remaining} {remaining === 1 ? "question" : "questions"} left. The most valuable one is first.
        </p>
      )}
      <Formula />
    </div>
  );
}

function Formula() {
  return (
    <details className="group mt-6 w-full max-w-sm rounded-lg text-left text-sm open:bg-sheet open:shadow-[0_0_0_1px_var(--rule)]">
      <summary className="cursor-pointer list-none rounded-lg px-4 py-2.5 text-center text-ink-2 hover:text-ink group-open:text-ink [&::-webkit-details-marker]:hidden">
        How is this calculated?
      </summary>
      <div className="space-y-3 px-4 pt-1 pb-4 text-ink-2">
        <p>An asset is covered when your heir would know all three, and it hasn&rsquo;t drifted:</p>
        <ul className="space-y-1.5">
          <li>
            <strong className="text-ink">Where</strong> the key is: a note on its wallet.
          </li>
          <li>
            <strong className="text-ink">How</strong> to open it: a note on the asset, or on its wallet if the asset is liquid. Staked SUI needs its own.
          </li>
          <li>
            <strong className="text-ink">Who</strong> receives it: a note on the asset or its wallet.
          </li>
        </ul>
        <p className="rounded-md bg-sheet-2 px-3 py-2 text-ink">Readiness = covered USD ÷ total USD × 100</p>
        <p>With no prices, it counts assets instead. If a balance falls below 75% or rises above 133% of what it was when you answered, that asset stops counting until you confirm the change.</p>
      </div>
    </details>
  );
}
