"use client";

import { ArrowRight, Coins, RefreshCw } from "lucide-react";
import { formatAmount, formatUsd } from "@/domain/format";
import { shortAddress } from "@/domain/ids";
import type { Asset, AssetCoverage } from "@/domain/types";
import type { OwnerCtx } from "./useOwner";

function Known({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-1.5 text-[0.68rem] font-medium ${on ? "bg-mint-wash text-mint" : "text-fg-3 shadow-[inset_0_0_0_1px_var(--line-2)]"}`}
      title={`${label}: ${on ? "your heir would know" : "not answered yet"}`}
    >
      {label}
      <span className="sr-only">{on ? " known" : " missing"}</span>
    </span>
  );
}

export function AssetAvatar({ a }: { a: Pick<Asset, "symbol" | "chain" | "kind"> }) {
  const tone = a.chain === "sui" ? "bg-sky-wash text-sky" : "bg-violet-wash text-violet";
  return (
    <span className={`relative grid size-8 shrink-0 place-items-center rounded-full text-[0.68rem] font-bold ${tone}`} aria-hidden="true">
      {a.symbol.slice(0, 3).toUpperCase()}
      {a.kind === "stake" && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-panel bg-amber" title="Staked" />}
    </span>
  );
}

function assetName(a: Asset) {
  return a.kind === "stake" ? `Staked ${a.symbol}` : a.symbol;
}

/** Everything Tatum can see, and what your heir would know about each. */
export function AssetsTable({ o, limit, onViewAll }: { o: OwnerCtx; limit?: number; onViewAll?: () => void }) {
  const scan = o.scan;
  const preview = limit !== undefined;

  const head = (
    <div className="card-head">
      <div className="min-w-0">
        <h2 id="ledger-title" className="card-title">
          <Coins className="size-4" aria-hidden="true" />
          {preview ? "What your heir would find" : "Assets"}
        </h2>
        {!preview && scan && (
          <p className="mt-0.5 text-[0.75rem] text-fg-3">
            {scan.scan.mode === "fixtures" ? "Fixture chain data in this deployment, not live balances." : `Read live from Mainnet through Tatum, ${scan.scan.tatumCalls} calls.`}
          </p>
        )}
      </div>
      {preview ? (
        onViewAll &&
        scan &&
        scan.scan.assets.length > 0 && (
          <button type="button" onClick={onViewAll} className="inline-flex items-center gap-1 text-[0.75rem] text-fg-2 hover:text-fg">
            View all <ArrowRight className="size-3.5" />
          </button>
        )
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void o.rescan()} disabled={o.scanning}>
          <RefreshCw className={o.scanning ? "animate-spin" : ""} />
          {o.scanning ? "Reading…" : "Rescan"}
        </button>
      )}
    </div>
  );

  if (!scan)
    return (
      <section className="card overflow-hidden" aria-labelledby="ledger-title">
        {head}
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      </section>
    );

  const cov = new Map<string, AssetCoverage>(scan.readiness.perAsset.map((c) => [c.assetKey, c]));
  const drift = new Map(scan.drift.drifted.map((d) => [d.assetKey, d]));
  const fresh = new Set(scan.drift.newAssets);
  const all = [...scan.scan.assets].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const assets = preview ? all.slice(0, limit) : all;
  const failed = scan.scan.wallets.filter((w) => w.error);

  return (
    <section className="card overflow-hidden" aria-labelledby="ledger-title">
      {head}
      {failed.length > 0 && (
        <p className="border-b border-line bg-amber-wash px-5 py-2.5 text-[0.8125rem] text-amber" role="status">
          Couldn&rsquo;t read {failed.map((w) => shortAddress(w.address)).join(", ")} just now. Its drift checks are paused until the next scan.
        </p>
      )}
      {assets.length === 0 ? (
        <p className="px-5 py-10 text-center text-[0.875rem] text-fg-3">No assets yet. Add a wallet and the agent reads it through Tatum.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`table ${preview ? "min-w-[520px]" : "min-w-[760px]"}`}>
            <caption className="sr-only">Assets and what your heir would know</caption>
            <thead>
              <tr>
                <th className="!pl-5">Asset</th>
                {!preview && <th>Wallet</th>}
                <th className="text-right">Value</th>
                <th>Heir knows</th>
                <th className="!pr-5 text-right">
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
                  <tr key={a.key}>
                    <td className="!pl-5">
                      <span className="flex items-center gap-3">
                        <AssetAvatar a={a} />
                        <span className="min-w-0">
                          <span className="block font-medium whitespace-nowrap">{assetName(a)}</span>
                          <span className="t-num block text-[0.75rem] whitespace-nowrap text-fg-3">
                            {formatAmount(a.amount, a.symbol)}
                            {a.meta.validatorName ? ` · ${a.meta.validatorName}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    {!preview && (
                      <td>
                        <span className="block max-w-[13rem] truncate">{label || (a.chain === "sui" ? "Sui wallet" : "Ethereum wallet")}</span>
                        <span className="t-mono text-[0.72rem] text-fg-3">{shortAddress(a.address)}</span>
                      </td>
                    )}
                    <td className="t-num text-right font-medium whitespace-nowrap">{a.usd === null ? <span className="font-normal text-fg-3">no price</span> : formatUsd(a.usd)}</td>
                    <td>
                      <span className="flex gap-1">
                        <Known on={!!c?.where} label="where" />
                        <Known on={!!c?.how} label="how" />
                        <Known on={!!c?.who} label="who" />
                      </span>
                    </td>
                    <td className="!pr-5 text-right">
                      {d ? (
                        <span className="pill pill-amber">{d.reason === "missing" ? "Gone" : d.reason === "dropped" ? "Dropped" : "Grew"}</span>
                      ) : c?.covered ? (
                        <span className="pill pill-mint">Covered</span>
                      ) : fresh.has(a.key) ? (
                        <span className="pill pill-violet">New</span>
                      ) : (
                        <span className="pill pill-muted">Open</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && all.length > assets.length && (
        <p className="border-t border-line px-5 py-2.5 text-[0.75rem] text-fg-3">
          {all.length - assets.length} more {all.length - assets.length === 1 ? "asset" : "assets"}
        </p>
      )}
    </section>
  );
}
