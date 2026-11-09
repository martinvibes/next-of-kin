"use client";

import { useState } from "react";
import { shortAddress, walletIdOf } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import type { Chain, WalletMemory } from "@/domain/types";
import { ApiFailure } from "@/lib/client";
import type { OwnerCtx } from "./useOwner";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem || dupe || labelSecret) return;
    setBusy(true);
    setErr(null);
    try {
      const addr = address.trim();
      const memory: WalletMemory = {
        ...o.newMeta(),
        kind: "wallet",
        walletId: walletIdOf(chain, addr),
        chain,
        address: chain === "sui" ? addr.toLowerCase() : addr,
        label: await o.enc(label.trim() || (chain === "sui" ? "Sui wallet" : "Ethereum wallet")),
      };
      await o.write(memory, { rescan: "refresh", cause: `added wallet ${shortAddress(addr)}` });
      setAddress("");
      setLabel("");
      onDone?.();
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Couldn't add that wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className} aria-label="Add a wallet">
      <div role="radiogroup" aria-label="Chain" className="inline-flex rounded-full bg-sheet-2 p-1 text-sm">
        {(["sui", "ethereum"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={chain === c}
            onClick={() => setChain(c)}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${chain === c ? "bg-ink text-sheet" : "text-ink-2 hover:text-ink"}`}
          >
            {c === "sui" ? "Sui" : "Ethereum"}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-2">From this deployment:</span>
          {suggestions.map((s) => (
            <button
              key={s.address}
              type="button"
              className="t-mono rounded-full border border-rule px-3 py-1 text-xs hover:border-ink"
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
          className="field t-mono text-[0.875rem]"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={chain === "sui" ? "0x7d20…a3f1" : "0x52a8…19c0"}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!problem || !!dupe}
          aria-describedby="wallet-address-help"
        />
        <p id="wallet-address-help" className={`help ${problem || dupe ? "text-claret" : ""}`}>
          {problem ?? (dupe ? "That wallet is already in your vault." : "Only the public address. Never a seed phrase or private key.")}
        </p>
      </div>
      <div className="mt-4">
        <label htmlFor="wallet-label" className="label">
          What do you call it?
        </label>
        <input
          id="wallet-label"
          className="field"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Savings on the Ledger"
          maxLength={80}
          aria-invalid={labelSecret}
        />
        <p className={`help ${labelSecret ? "text-claret" : ""}`}>{labelSecret ? SECRET_MESSAGE : "Encrypted in this browser before it's stored."}</p>
      </div>
      {err && (
        <p className="mt-4 rounded-lg bg-claret-wash px-3 py-2 text-sm text-claret" role="alert">
          {err}
        </p>
      )}
      <button className="btn btn-primary mt-6" disabled={busy || !address.trim() || !!problem || !!dupe || labelSecret}>
        {busy ? "Reading it through Tatum…" : "Add wallet"}
      </button>
    </form>
  );
}

export function WalletsPanel({ o }: { o: OwnerCtx }) {
  const [adding, setAdding] = useState(false);
  const wallets = o.state?.state.wallets ?? [];
  const scans = new Map(o.scan?.scan.wallets.map((w) => [w.walletId, w]) ?? []);

  return (
    <section className="sheet flex flex-col p-6 sm:p-7" aria-labelledby="wallets-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="wallets-title" className="t-serif text-[1.35rem]">
          Wallets
        </h2>
        {wallets.length > 0 && !adding && (
          <button type="button" className="link text-sm" onClick={() => setAdding(true)}>
            Add another
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-2">Public addresses only. Tatum reads them; nothing here can move funds.</p>

      {wallets.length > 0 && (
        <ul className="mt-5 divide-y divide-rule-soft border-y border-rule-soft">
          {wallets.map((w) => {
            const s = scans.get(w.walletId);
            const n = s?.assets.length ?? 0;
            return (
              <li key={w.walletId} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.dec?.labels[w.walletId] || "Wallet"}</p>
                  <p className="t-mono text-xs text-ink-3">
                    {w.chain === "sui" ? "Sui" : "Ethereum"} · {shortAddress(w.address)}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-ink-2">{s?.error ? <span className="text-amber">unreadable</span> : s ? `${n} ${n === 1 ? "asset" : "assets"}` : "…"}</p>
              </li>
            );
          })}
        </ul>
      )}

      {wallets.length === 0 && !adding && <p className="mt-5 text-sm text-ink-2">Your first wallet goes in the card at the top of the page.</p>}

      {adding && (
        <div className="mt-5">
          <WalletForm o={o} onDone={() => setAdding(false)} />
          <button type="button" className="btn btn-quiet mt-2" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
