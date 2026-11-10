"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Wallet } from "lucide-react";
import { formatUsd, relativeTime } from "@/domain/format";
import { shortAddress, walletIdOf } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import type { Chain, WalletMemory } from "@/domain/types";
import { errorText, isRetryable } from "@/lib/client";
import { CopyButton } from "@/components/Receipt";
import { toast } from "@/components/ui/Toast";
import { readinessNote, type OwnerCtx } from "./useOwner";

const ADDRESS: Record<Chain, RegExp> = {
  sui: /^0x[0-9a-fA-F]{64}$/,
  ethereum: /^0x[0-9a-fA-F]{40}$/,
};

function addressProblem(chain: Chain, raw: string): string | null {
  const a = raw.trim();
  if (!a) return null;
  if (detectSecret(a).blocked) return SECRET_MESSAGE;
  if (!a.startsWith("0x")) return "Addresses start with 0x.";
  if (!ADDRESS[chain].test(a)) return chain === "sui" ? "A Sui address is 0x followed by 64 hex characters." : "An Ethereum address is 0x followed by 40 hex characters.";
  return null;
}

export function WalletForm({ o, className = "", onDone }: { o: OwnerCtx; className?: string; onDone?: () => void }) {
  const [chain, setChain] = useState<Chain>("sui");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const known = new Set(o.state?.state.wallets.map((w) => w.walletId) ?? []);
  const suggestions = (o.state?.suggestedWallets ?? []).filter((s) => !known.has(walletIdOf(s.chain, s.address)));
  const problem = addressProblem(chain, address);
  const dupe = address.trim() && !problem && known.has(walletIdOf(chain, address.trim()));
  const labelSecret = detectSecret(label).blocked;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (problem || dupe || labelSecret) return;
    setBusy(true);
    setErr(null);
    try {
      const addr = address.trim();
      const name = label.trim() || (chain === "sui" ? "Sui wallet" : "Ethereum wallet");
      const memory: WalletMemory = {
        ...o.newMeta(),
        kind: "wallet",
        walletId: walletIdOf(chain, addr),
        chain,
        address: chain === "sui" ? addr.toLowerCase() : addr,
        label: await o.enc(name),
      };
      const res = await o.write(memory, { rescan: "refresh", cause: `added wallet ${shortAddress(addr)}` });
      setAddress("");
      setLabel("");
      onDone?.();
      const read = res.scan?.scan.wallets.find((w) => w.walletId === memory.walletId);
      const source = o.status.chain.mode === "live" ? "through Tatum" : "from fixture data, not live";
      if (!read || read.error)
        toast.info("Wallet added", `${name} (${shortAddress(addr)}) is in your vault, but its balances couldn't be read yet. They'll show after the next scan.`);
      else {
        const n = read.assets.length;
        toast.success("Wallet added", `${name} (${shortAddress(addr)}): ${n} asset${n === 1 ? "" : "s"} read ${source}. ${readinessNote(res.before, res.after)} ${res.scan?.questions.some((q) => q.walletId === memory.walletId) ? "Its questions are on the Questions tab." : ""}`);
      }
    } catch (e) {
      const msg = errorText(e, "The wallet wasn't added.");
      if (isRetryable(e)) toast.error("Wallet not added", msg, { label: "Try again", onClick: () => void submit() });
      else setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className} aria-label="Add a wallet">
      <div role="radiogroup" aria-label="Chain" className="inline-flex rounded-lg border border-line bg-bg-2 p-0.5 text-[0.8125rem]">
        {(["sui", "ethereum"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={chain === c}
            onClick={() => setChain(c)}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors ${chain === c ? "bg-panel-3 text-fg shadow-[inset_0_0_0_1px_var(--line-2)]" : "text-fg-3 hover:text-fg"}`}
          >
            {c === "sui" ? "Sui" : "Ethereum"}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.75rem]">
          <span className="text-fg-3">From this deployment:</span>
          {suggestions.map((s) => (
            <button
              key={s.address}
              type="button"
              className="t-mono rounded-md border border-line-2 bg-panel-2 px-2 py-1 text-[0.72rem] text-fg-2 hover:border-mint/40 hover:text-fg"
              onClick={() => {
                setChain(s.chain);
                setAddress(s.address);
              }}
            >
              {shortAddress(s.address)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="wallet-address" className="label">
          Public address
        </label>
        <input
          id="wallet-address"
          className="input t-mono !text-[0.8125rem]"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={chain === "sui" ? "0x7d20…a3f1" : "0x52a8…19c0"}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!problem || !!dupe}
          aria-describedby="wallet-address-help"
        />
        <p id="wallet-address-help" className={`help ${problem || dupe ? "!text-rose" : ""}`}>
          {problem ?? (dupe ? "That wallet is already in your vault." : "Only the public address. Never a seed phrase or private key.")}
        </p>
      </div>
      <div className="mt-3">
        <label htmlFor="wallet-label" className="label">
          What do you call it?
        </label>
        <input id="wallet-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Savings on the Ledger" maxLength={80} aria-invalid={labelSecret} />
        <p className={`help ${labelSecret ? "!text-rose" : ""}`}>{labelSecret ? SECRET_MESSAGE : "Encrypted in this browser before it's stored."}</p>
      </div>
      {err && (
        <p className="mt-3 rounded-lg border border-rose/20 bg-rose-wash px-3 py-2 text-[0.8125rem] text-rose" role="alert">
          {err}
        </p>
      )}
      <button className="btn btn-primary mt-5 w-full sm:w-auto" disabled={busy || !address.trim() || !!problem || !!dupe || labelSecret}>
        <Plus />
        {busy ? "Reading it through Tatum…" : "Add wallet"}
      </button>
    </form>
  );
}

export function WalletsView({ o }: { o: OwnerCtx }) {
  const wallets = o.state?.state.wallets ?? [];
  const scans = new Map(o.scan?.scan.wallets.map((w) => [w.walletId, w]) ?? []);
  const cov = new Map(o.scan?.readiness.perAsset.map((c) => [c.assetKey, c]) ?? []);
  const now = new Date().toISOString();

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        {!o.state ? (
          <div className="grid grid-cols-1 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : wallets.length === 0 ? (
          <div className="card grid place-items-center px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-black/[0.04] text-fg-3">
              <Wallet className="size-5" />
            </span>
            <p className="mt-4 font-medium">No wallets yet</p>
            <p className="mt-1 max-w-sm text-[0.8125rem] text-fg-3">Add a public address on the right. The agent reads it through Tatum and starts asking.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4">
            {wallets.map((w) => {
              const s = scans.get(w.walletId);
              const assets = s?.assets ?? [];
              const total = assets.reduce((t, a) => t + (a.usd ?? 0), 0);
              const covered = assets.reduce((t, a) => t + (cov.get(a.key)?.covered ? (a.usd ?? 0) : 0), 0);
              const pct = total > 0 ? Math.round((covered / total) * 100) : assets.length ? Math.round((assets.filter((a) => cov.get(a.key)?.covered).length / assets.length) * 100) : 0;
              return (
                <li key={w.walletId} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-[0.7rem] font-bold ${w.chain === "sui" ? "bg-sky-wash text-sky" : "bg-violet-wash text-violet"}`}>{w.chain === "sui" ? "SUI" : "ETH"}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{o.dec?.labels[w.walletId] || "Wallet"}</span>
                        <span className="block text-[0.72rem] text-fg-3">{w.chain === "sui" ? "Sui Mainnet" : "Ethereum Mainnet"}</span>
                      </span>
                    </span>
                    {s?.error ? (
                      <span className="pill pill-amber">
                        <AlertTriangle /> Unreadable
                      </span>
                    ) : (
                      <span className={`pill t-num ${pct >= 100 ? "pill-mint" : "pill-muted"}`}>{s ? `${pct}% covered` : "…"}</span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-1 rounded-lg border border-line bg-bg-2 py-1 pr-1 pl-3">
                    <span className="t-mono min-w-0 flex-1 truncate text-[0.75rem] text-fg-2" title={w.address}>
                      {w.address}
                    </span>
                    <CopyButton value={w.address} label="Copy address" />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-[0.75rem]">
                    <div>
                      <dt className="text-fg-3">Assets</dt>
                      <dd className="t-num mt-0.5 text-[0.9375rem] font-semibold">{s ? assets.length : "…"}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-3">Value</dt>
                      <dd className="t-num mt-0.5 text-[0.9375rem] font-semibold">{s ? (total > 0 ? formatUsd(total) : "—") : "…"}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-3">Last sent</dt>
                      <dd className="mt-0.5 text-[0.8125rem] font-medium">{s?.lastOutgoingTx ? relativeTime(s.lastOutgoingTx, now) : w.chain === "sui" ? "None seen" : "—"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="card overflow-hidden lg:sticky lg:top-24" aria-labelledby="add-wallet-title">
        <div className="card-head">
          <h2 id="add-wallet-title" className="card-title">
            <Plus className="size-4" aria-hidden="true" />
            Add a wallet
          </h2>
        </div>
        <div className="p-5">
          <p className="mb-4 text-[0.8125rem] text-fg-2">Public addresses only. Tatum reads them; nothing here can move funds.</p>
          <WalletForm o={o} />
        </div>
      </aside>
    </div>
  );
}
