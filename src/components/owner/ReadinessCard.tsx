"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Meter, Ring } from "@/components/ui/Ring";
import { Odometer } from "@/components/ui/Odometer";
import { Corners } from "@/components/motion/Backdrop";
import { formatUsd } from "@/domain/format";
import { greeting } from "@/lib/time";
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

/** The top of Home: one sentence that says where things stand, the dial, and the three parts of it. */
export function ReadinessHero({ o }: { o: OwnerCtx }) {
  const [explain, setExplain] = useState(false);
  const r = o.scan?.readiness;
  const d = dimensions(o.scan);
  const drifted = o.scan?.drift.drifted.length ?? 0;
  const score = r?.score ?? 0;
  const owner = o.dec?.ownerName?.trim().split(/\s+/)[0];
  const heir = o.dec?.heirName?.trim() || "Your heir";
  const wallets = o.state?.state.wallets.length ?? 0;

  let headline: React.ReactNode = (
    <span className="skeleton inline-block h-10 w-[22rem] max-w-full align-middle" />
  );
  if (o.state && wallets === 0)
    headline = "Add a wallet and the questions begin.";
  else if (r && r.basis === "usd")
    headline = (
      <>
        {heir} could recover <Odometer value={formatUsd(r.coveredUsd)} /> of
        your {formatUsd(r.totalUsd)} today.
      </>
    );
  else if (r)
    headline = `${heir} knows enough for ${r.covered} of ${r.assets} assets.`;

  const full = !!r && score >= 100 && drifted === 0;

  return (
    <div className="relative">
      <Corners />
      <section className="card overflow-hidden" aria-labelledby="ready-title">
        <div
          className={`flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between [&>[role=img]]:self-center ${full ? "wash-green" : "wash-orange"}`}
        >
          <div className="min-w-0 max-w-[36rem]">
            <p className="text-[0.875rem] text-fg-3">
              {greeting()}
              {owner ? `, ${owner}` : ""}
            </p>
            <h1
              id="ready-title"
              className="t-display mt-2 text-[clamp(1.9rem,3.6vw,2.7rem)] leading-[1.1]"
            >
              {headline}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {drifted > 0 && (
                <span className="pill pill-amber">
                  {drifted} balance{drifted === 1 ? "" : "s"} changed
                </span>
              )}
              {full && <span className="pill pill-mint">Fully covered</span>}
              <button
                type="button"
                className="btn btn-ghost btn-sm -ml-2"
                onClick={() => setExplain((e) => !e)}
                aria-expanded={explain}
              >
                {explain ? "Hide the maths" : "How is this worked out?"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => o.runScan({ refresh: true })}
                disabled={o.scanning}
              >
                <RefreshCw className={o.scanning ? "animate-spin" : ""} />
                {o.scanning ? "Reading the chain…" : "Rescan"}
              </button>
            </div>
          </div>
          <Ring
            value={r ? score : 0}
            size={176}
            stroke={10}
            tone={drifted > 0 ? "amber" : "mint"}
            label={`Heir readiness ${score}%`}
          >
            {r ? (
              <>
                <span className="t-num text-[2.6rem] leading-none font-semibold tracking-[-0.04em]">
                  <Odometer value={String(score)} />
                  <span className="ml-0.5 align-top text-[1.1rem] text-fg-3">
                    %
                  </span>
                </span>
                <span className="mt-1.5 text-[0.75rem] text-fg-3">
                  {r.covered} of {r.assets}{" "}
                  {r.assets === 1 ? "asset" : "assets"} covered
                </span>
              </>
            ) : (
              <span className="text-[0.75rem] text-fg-3 animate-pulse-soft">
                Reading…
              </span>
            )}
          </Ring>
        </div>

        {explain && (
          <div className="grid grid-cols-1 gap-6 border-t border-line bg-panel-2 px-6 py-6 text-[0.875rem] text-fg-2 animate-fade sm:px-8 md:grid-cols-2">
            <div className="space-y-2">
              <p>
                An asset counts once your heir would know all three, and its
                balance hasn&rsquo;t changed much since you answered:
              </p>
              <ul className="space-y-1">
                <li>
                  <strong className="font-medium text-fg">Where</strong> the key
                  is, noted on its wallet.
                </li>
                <li>
                  <strong className="font-medium text-fg">How</strong> to open
                  it. Staked SUI needs its own answer.
                </li>
                <li>
                  <strong className="font-medium text-fg">Who</strong> should
                  receive it.
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="t-mono rounded-lg border border-line bg-panel px-3 py-2 text-[0.78rem] text-fg">
                readiness = covered USD ÷ total USD × 100
              </p>
              <p>
                If nothing has a price it counts assets instead. A balance below
                75% or above 133% of what it was stops counting until you
                confirm it.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 border-t border-line sm:grid-cols-3">
          {d
            ? [
                { k: "Where the keys are", v: d.where },
                { k: "How to open them", v: d.how },
                { k: "Who receives what", v: d.who },
              ].map((m, i) => (
                <div
                  key={m.k}
                  className={`px-6 py-5 sm:px-8 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}
                >
                  <Meter label={m.k} value={m.v} />
                </div>
              ))
            : [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`px-6 py-5 sm:px-8 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}
                >
                  <div className="skeleton h-3.5 w-28" />
                  <div className="skeleton mt-2.5 h-1.5 w-full" />
                </div>
              ))}
        </div>
        {drifted > 0 && (
          <p className="border-t border-line bg-amber-wash px-6 py-3 text-[0.8125rem] text-amber sm:px-8">
            Answers on an asset whose balance changed stop counting until you
            confirm them on the Questions tab.
          </p>
        )}
      </section>
    </div>
  );
}
