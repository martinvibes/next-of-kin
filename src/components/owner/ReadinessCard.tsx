"use client";

import { useState } from "react";
import { Gauge, Info, X } from "lucide-react";
import { Meter, Ring } from "@/components/ui/Ring";
import type { ScanResponse } from "@/lib/api-types";
import type { OwnerCtx } from "./useOwner";

/** USD-weighted share of assets whose heir knows each of where / how / who. Drifted assets don't count until confirmed, as in the score. */
export function dimensions(scan: ScanResponse | null) {
  if (!scan) return null;
  const byKey = new Map(scan.scan.assets.map((a) => [a.key, a]));
  const usd = scan.readiness.basis === "usd";
  let total = 0;
  const sum = { where: 0, how: 0, who: 0 };
  for (const c of scan.readiness.perAsset) {
    const w = usd ? (byKey.get(c.assetKey)?.usd ?? 0) : 1;
    total += w;
    if (c.drifted) continue;
    if (c.where) sum.where += w;
    if (c.how) sum.how += w;
    if (c.who) sum.who += w;
  }
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return { where: pct(sum.where), how: pct(sum.how), who: pct(sum.who) };
}

export function ReadinessCard({ o, className = "" }: { o: OwnerCtx; className?: string }) {
  const [explain, setExplain] = useState(false);
  const r = o.scan?.readiness;
  const d = dimensions(o.scan);
  const drifted = o.scan?.drift.drifted.length ?? 0;
  const score = r?.score ?? 0;
  const tone = drifted > 0 ? "amber" : "mint";

  return (
    <section className={`card glow-mint relative flex min-w-0 flex-col overflow-hidden ${className}`} aria-labelledby="ready-title">
      <div className="card-head border-0 pb-0">
        <h2 id="ready-title" className="card-title">
          <Gauge className="size-4" aria-hidden="true" />
          Heir readiness
        </h2>
        <div className="flex items-center gap-1.5">
          {r && (drifted > 0 ? <span className="pill pill-amber">{drifted} drifted</span> : score >= 100 ? <span className="pill pill-mint">Fully covered</span> : null)}
          <button type="button" className="inline-grid size-7 place-items-center rounded-md text-fg-3 hover:bg-white/5 hover:text-fg" onClick={() => setExplain((e) => !e)} aria-expanded={explain} aria-label="How is readiness calculated?">
            {explain ? <X className="size-4" /> : <Info className="size-4" />}
          </button>
        </div>
      </div>

      {explain ? (
        <div className="space-y-3 px-5 pt-3 pb-5 text-[0.8125rem] text-fg-2 animate-fade">
          <p>An asset counts once your heir would know all three of these, and its balance hasn&rsquo;t drifted:</p>
          <ul className="space-y-1.5">
            <li>
              <strong className="text-fg">Where</strong> the key is: a note on its wallet.
            </li>
            <li>
              <strong className="text-fg">How</strong> to open it: on the asset, or its wallet if liquid. Staked SUI needs its own.
            </li>
            <li>
              <strong className="text-fg">Who</strong> receives it: on the asset or its wallet.
            </li>
          </ul>
          <p className="t-mono rounded-lg border border-line bg-bg-2 px-3 py-2 text-[0.75rem] text-fg">readiness = covered USD ÷ total USD × 100</p>
          <p>Falls back to counting assets when nothing has a price. A balance below 75% or above 133% of what it was when you answered stops counting until you confirm it.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-6 px-5 pt-4 pb-6 sm:flex-row sm:items-center">
          <Ring value={r ? score : 0} size={184} tone={tone} label={`Heir readiness ${score}%`}>
            {r ? (
              <>
                <span className="t-num text-[2.6rem] leading-none font-semibold tracking-[-0.04em]">
                  {score}
                  <span className="ml-0.5 align-top text-[1.1rem] text-fg-2">%</span>
                </span>
                <span className="mt-1.5 text-[0.72rem] text-fg-3">
                  {r.covered} of {r.assets} {r.assets === 1 ? "asset" : "assets"} covered
                </span>
              </>
            ) : (
              <span className="text-[0.75rem] text-fg-3 animate-pulse-soft">Reading…</span>
            )}
          </Ring>
          <div className="w-full min-w-0 flex-1 space-y-4">
            {d ? (
              <>
                <Meter label="Where the keys are" value={d.where} tone="mint" />
                <Meter label="How to open them" value={d.how} tone="violet" />
                <Meter label="Who receives what" value={d.who} tone="sky" />
                {drifted > 0 && <p className="text-[0.72rem] leading-snug text-amber">Answers on a drifted asset stop counting until you confirm them.</p>}
              </>
            ) : (
              [0, 1, 2].map((i) => (
                <div key={i}>
                  <div className="skeleton h-3.5 w-28" />
                  <div className="skeleton mt-2 h-1.5 w-full" />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
