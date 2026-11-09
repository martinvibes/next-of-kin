"use client";

import { formatAmount, formatUsd } from "@/domain/format";
import { shortAddress } from "@/domain/ids";
import type { Asset, AssetCoverage } from "@/domain/types";
import type { OwnerCtx } from "./useOwner";

function Tick({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${on ? "bg-ink text-sheet" : "text-ink-3 shadow-[inset_0_0_0_1px_var(--rule)]"}`}
      title={`${label}: ${on ? "your heir would know" : "not answered yet"}`}
    >
      <span aria-hidden="true">{on ? "✓" : "·"}</span>
      {label}
      <span className="sr-only">{on ? " known" : " missing"}</span>
    </span>
  );
}

function assetName(a: Asset) {
  if (a.kind === "stake") return `Staked ${a.symbol}`;
  return a.symbol;
}

/** Everything Tatum can see, and what your heir would know about each. */
export function Ledger({ o }: { o: OwnerCtx }) {
  const scan = o.scan;
  if (!scan || scan.scan.assets.length === 0) return null;

  const cov = new Map<string, AssetCoverage>(scan.readiness.perAsset.map((c) => [c.assetKey, c]));
  const drift = new Map(scan.drift.drifted.map((d) => [d.assetKey, d]));
  const fresh = new Set(scan.drift.newAssets);
  const assets = [...scan.scan.assets].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const failed = scan.scan.wallets.filter((w) => w.error);

  return (
    <section className="mt-20" aria-labelledby="ledger-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ledger-title" className="t-display text-[clamp(1.8rem,3.4vw,2.4rem)] leading-tight">
            What your heir would find
          </h2>
          <p className="mt-2 max-w-xl text-ink-2">
            {scan.scan.mode === "fixtures" ? "Fixture chain data in this deployment, not live balances." : "Read live from Mainnet through Tatum."} An asset counts once your heir knows where, how and who.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => o.runScan({ refresh: true })} disabled={o.scanning}>
          {o.scanning ? "Reading the chain…" : "Rescan wallets"}
        </button>
      </div>

      {failed.length > 0 && (
        <p className="mt-4 rounded-lg bg-amber-wash px-4 py-2.5 text-sm text-amber" role="status">
          Couldn&rsquo;t read {failed.map((w) => shortAddress(w.address)).join(", ")} just now. Its drift checks are paused until the next scan.
        </p>
      )}

      <div className="sheet mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[0.9375rem]">
          <caption className="sr-only">Assets and coverage</caption>
          <thead className="text-[0.8125rem] text-ink-2">
            <tr className="border-b border-rule-soft">
              <th className="px-5 py-3 font-medium sm:px-6">Asset</th>
              <th className="px-3 py-3 font-medium">Wallet</th>
              <th className="px-3 py-3 text-right font-medium">Amount</th>
              <th className="px-3 py-3 text-right font-medium">Value</th>
              <th className="px-3 py-3 font-medium">Heir knows</th>
              <th className="px-5 py-3 font-medium sm:px-6">
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const c = cov.get(a.key);
              const d = drift.get(a.key);
              const label = o.dec?.labels[a.walletId];
              return (
                <tr key={a.key} className="border-b border-rule-soft last:border-0">
                  <td className="px-5 py-3.5 sm:px-6">
                    <span className="font-semibold">{assetName(a)}</span>
                    {a.meta.validatorName && <span className="block text-xs text-ink-2">with {a.meta.validatorName}</span>}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="block max-w-[14rem] truncate">{label || (a.chain === "sui" ? "Sui wallet" : "Ethereum wallet")}</span>
                    <span className="t-mono text-xs text-ink-3">{shortAddress(a.address)}</span>
                  </td>
                  <td className="t-num px-3 py-3.5 text-right whitespace-nowrap">{formatAmount(a.amount, a.symbol)}</td>
                  <td className="t-num px-3 py-3.5 text-right whitespace-nowrap">{a.usd === null ? <span className="text-ink-3">no price</span> : formatUsd(a.usd)}</td>
                  <td className="px-3 py-3.5">
                    <span className="flex gap-1">
                      <Tick on={!!c?.where} label="where" />
                      <Tick on={!!c?.how} label="how" />
                      <Tick on={!!c?.who} label="who" />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right sm:px-6">
                    {d ? (
                      <span className="rounded-full bg-amber-wash px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-amber">
                        {d.reason === "missing" ? "Gone" : d.reason === "dropped" ? "Dropped" : "Grew"}
                      </span>
                    ) : c?.covered ? (
                      <span className="rounded-full bg-moss-wash px-2.5 py-1 text-xs font-semibold text-moss">Covered</span>
                    ) : fresh.has(a.key) ? (
                      <span className="rounded-full bg-brass-wash px-2.5 py-1 text-xs font-semibold text-brass">New</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
