"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Lock, Printer, ShieldAlert } from "lucide-react";
import { decryptFieldOrNull, unlockVault } from "@/domain/crypto";
import { formatAmount, formatInterval, formatUsd, relativeTime } from "@/domain/format";
import type { Asset } from "@/domain/types";
import { buildGuide, orphanedAssetFacts, type DecryptedFact, type DecryptedWallet, type GuideWallet } from "@/domain/heir";
import { shortAddress } from "@/domain/ids";
import type { HeirBundleResponse, ReleasedBundle, SealedBundle, StatusResponse } from "@/lib/api-types";
import { api, ApiFailure } from "@/lib/client";
import { countdown, useNow } from "@/lib/time";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BlobLink, CopyButton } from "@/components/Receipt";

interface Opened {
  ownerName: string | null;
  heirName: string | null;
  heirContact: string | null;
  letter: string | null;
  guide: GuideWallet[];
  orphans: DecryptedFact[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

export function HeirApp() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [bundle, setBundle] = useState<HeirBundleResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  useEffect(() => {
    api<StatusResponse>("/api/status").then(setStatus).catch(() => {});
    api<HeirBundleResponse>("/api/heir/bundle")
      .then(setBundle)
      .catch((e) => setErr(e instanceof ApiFailure ? e.message : "Couldn't reach this deployment."));
  }, []);

  return (
    <div className="min-h-dvh">
      <ModeBanner status={status} />
      <SiteHeader current="heir" />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        {err ? (
          <p className="py-24 text-center text-fg-2" role="alert">
            {err}
          </p>
        ) : !bundle ? (
          <div className="mx-auto max-w-lg py-24" role="status">
            <div className="skeleton mx-auto h-5 w-20" />
            <div className="skeleton mx-auto mt-6 h-10 w-72 max-w-full" />
            <div className="skeleton mx-auto mt-3 h-4 w-80 max-w-full" />
          </div>
        ) : bundle.phase !== "released" ? (
          <Sealed b={bundle} />
        ) : opened ? (
          <Letter b={bundle} o={opened} fixtures={status?.chain.mode === "fixtures"} />
        ) : (
          <Envelope b={bundle} onOpen={setOpened} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Sealed({ b }: { b: SealedBundle }) {
  const now = useNow();
  const sw = b.switch;
  const opensIn = sw.releaseAt ? new Date(sw.releaseAt).getTime() - now : null;
  useEffect(() => {
    if (opensIn !== null && opensIn <= 0 && opensIn > -1500) window.location.reload();
  }, [opensIn]);

  if (b.phase === "setup")
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center py-24 text-center animate-rise">
        <span className="pill pill-muted">Nothing here yet</span>
        <h1 className="t-display mt-5 text-[clamp(2.2rem,5vw,3rem)] leading-[1.05]">No letter has been written here yet</h1>
        <p className="mt-4 text-fg-2">When someone prepares one for you on this deployment, this is where it will open.</p>
      </section>
    );

  const overdue = b.phase === "overdue";
  const start = sw.lastAlive ? Date.parse(sw.lastAlive) : null;
  const end = sw.releaseAt ? Date.parse(sw.releaseAt) : null;
  const frac = start && end && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;
  const source = sw.lastAliveSource === "onchain" ? "an on-chain transaction, via Tatum" : sw.lastAliveSource === "checkin" ? "a check-in" : sw.lastAliveSource === "profile" ? "when the vault was set up" : "";

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center animate-rise sm:py-24">
      {overdue ? (
        <span className="pill pill-amber">
          <AlertTriangle /> Check-in missed
        </span>
      ) : (
        <span className="pill pill-muted">
          <Lock /> Sealed
        </span>
      )}
      <h1 className="t-display mt-5 text-[clamp(2.3rem,5.5vw,3.25rem)] leading-[1.05]">{overdue ? "The owner has missed a check-in" : "This letter is still sealed"}</h1>
      <p className="mt-4 max-w-lg text-[1.0625rem] text-fg-2">
        {overdue
          ? "A grace period has started. If they don't check in, and their Sui wallets stay quiet, the letter opens here."
          : "It opens only if the owner stops checking in and their Sui wallets go quiet for the whole interval. Nothing inside can be read until then."}
      </p>

      <div className="mt-14 w-full max-w-lg">
        <p className="text-[0.8125rem] text-fg-3">Opens, at the earliest</p>
        <p className="t-num mt-2 text-[clamp(2.75rem,9vw,4.25rem)] leading-none font-medium tracking-[-0.045em]" aria-live="off">
          {opensIn !== null ? (opensIn > 0 ? countdown(opensIn) : "any moment") : "—"}
        </p>
        {sw.releaseAt && <p className="mt-3 text-[0.8125rem] text-fg-3">{fmtDate(sw.releaseAt)}</p>}

        <div className="relative mt-8 h-[2px] rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-ember transition-[width] duration-1000 ease-linear" style={{ width: `${frac * 100}%` }} />
          <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember animate-beat" style={{ left: `${frac * 100}%` }} />
        </div>

        <dl className="mt-8 grid grid-cols-2 border-t border-line text-left">
          <div className="py-4 pr-4">
            <dt className="text-[0.8125rem] text-fg-3">Last sign of life</dt>
            <dd className="mt-1 font-medium">{sw.lastAlive ? relativeTime(sw.lastAlive, new Date(now).toISOString()) : "—"}</dd>
            {source && <dd className="text-[0.78rem] text-fg-3">From {source}</dd>}
          </div>
          <div className="border-l border-line py-4 pl-4">
            <dt className="text-[0.8125rem] text-fg-3">Check-in rhythm</dt>
            <dd className="mt-1 font-medium">Every {formatInterval(sw.intervalSec)}</dd>
            <dd className="text-[0.78rem] text-fg-3">then {formatInterval(sw.graceSec)} grace</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Envelope({ b, onOpen }: { b: ReleasedBundle; onOpen: (o: Opened) => void }) {
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const key = await unlockVault(b.vault, pass);
      if (!key) {
        setErr("That passphrase doesn't open this letter. It's case-sensitive; check the spaces too.");
        return;
      }
      const wallets: DecryptedWallet[] = await Promise.all(
        b.wallets.map(async (w) => ({ walletId: w.walletId, chain: w.chain, address: w.address, label: (await decryptFieldOrNull(key, w.label)) ?? "Wallet" })),
      );
      const facts: DecryptedFact[] = [];
      for (const f of b.facts) {
        const value = await decryptFieldOrNull(key, f.value);
        if (value !== null) facts.push({ target: f.target, field: f.field, value });
      }
      const [ownerName, heirName, heirContact, letter] = await Promise.all([
        decryptFieldOrNull(key, b.profile?.ownerName),
        decryptFieldOrNull(key, b.profile?.heirName),
        decryptFieldOrNull(key, b.profile?.heirContact),
        decryptFieldOrNull(key, b.letter?.value),
      ]);
      onOpen({ ownerName, heirName, heirContact, letter, guide: buildGuide({ wallets, facts, assets: b.assets }), orphans: orphanedAssetFacts(facts, b.assets) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[460px] py-16 animate-rise sm:py-24">
      <form onSubmit={open} className="card p-7 sm:p-9" aria-labelledby="env-title">
        <span className="pill pill-ember">Released</span>
        <h1 id="env-title" className="t-display mt-5 text-[2.2rem] leading-[1.05]">
          A letter has been left for you
        </h1>
        <p className="mt-3 text-[0.9375rem] text-fg-2">It&rsquo;s locked with a passphrase that was written down for you, often kept with a will. It never leaves this browser.</p>
        <label htmlFor="heir-pass" className="label mt-8">
          Passphrase
        </label>
        <div className="relative">
          <input id="heir-pass" className="input !pr-11" type={show ? "text" : "password"} autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus required />
          <button type="button" className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:text-fg" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passphrase" : "Show passphrase"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {err && (
          <p className="mt-4 rounded-lg bg-rose-wash px-3.5 py-2.5 text-[0.8125rem] text-rose" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn-primary btn-lg mt-6 w-full" disabled={busy || !pass}>
          {busy ? "Opening…" : "Open the letter"}
        </button>
      </form>
      <Audit b={b} className="mt-4" />
    </section>
  );
}

function Audit({ b, className = "" }: { b: ReleasedBundle; className?: string }) {
  if (!b.audit) return null;
  const m = b.audit.memory;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3 text-[0.8125rem] ${className}`}>
      <div className="min-w-0">
        <p className="font-medium">Released {fmtDate(m.ts)}</p>
        <p className="text-fg-3">
          {m.reason} {m.verifiedVia === "tatum" ? "Verified on-chain via Tatum." : m.verifiedVia === "checkins" ? "Based on missed check-ins." : ""}
        </p>
      </div>
      {b.audit.blobId ? <BlobLink blobId={b.audit.blobId} mock={b.audit.blobId.startsWith("mock")} /> : <span className="text-fg-3">Writing to Walrus…</span>}
    </div>
  );
}

/** A plain grey coin with the ticker; staked positions get a small ring. */
function Coin({ a }: { a: Pick<Asset, "symbol" | "kind"> }) {
  return (
    <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-line bg-bg-2 text-[0.66rem] font-semibold text-fg-2" aria-hidden="true">
      {a.symbol.slice(0, 3).toUpperCase()}
      {a.kind === "stake" && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-panel bg-fg" title="Staked" />}
    </span>
  );
}

function Note({ label, value }: { label: string; value?: string }) {
  return (
    <div className="print-avoid grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[0.8125rem] text-fg-3">{label}</dt>
      <dd className={`whitespace-pre-wrap ${value ? "text-[0.9375rem] leading-relaxed text-fg" : "text-[0.875rem] text-fg-3 italic"}`}>{value ?? "Not written down. Look through their devices and papers."}</dd>
    </div>
  );
}

function Letter({ b, o, fixtures }: { b: ReleasedBundle; o: Opened; fixtures: boolean }) {
  const total = b.assets.reduce((s, a) => s + (a.usd ?? 0), 0);
  return (
    <div className="mx-auto max-w-3xl py-10 animate-rise sm:py-14">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-[0.8125rem] text-fg-2">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden="true" />
          <span>
            Opened in this browser.{" "}
            {fixtures ? "Balances are fixture data on this deployment, not live." : `Balances read ${b.scannedAt ? relativeTime(b.scannedAt, new Date().toISOString()) : "—"} from Mainnet through Tatum.`}
          </span>
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          <Printer /> Print this guide
        </button>
      </div>

      <article className="paper px-7 py-10 sm:px-16 sm:py-16" aria-labelledby="letter-to">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-black/10 pb-6">
          <div>
            <p id="letter-to" className="t-display text-[1.6rem] leading-tight">
              For {o.heirName ?? "you"}
            </p>
            {o.heirContact && <p className="mt-1 text-[0.8125rem] text-black/50">{o.heirContact}</p>}
          </div>
          <p className="text-[0.8125rem] text-black/50">{b.letter ? new Date(b.letter.ts).toLocaleDateString(undefined, { dateStyle: "long" }) : ""}</p>
        </header>
        {o.letter ? (
          <div className="t-letter mt-8 whitespace-pre-wrap">{o.letter}</div>
        ) : (
          <p className="t-letter mt-8 text-black/50 italic">No personal letter was written. The guide below is everything they recorded.</p>
        )}
        {o.ownerName && <p className="mt-10 font-[family-name:var(--font-hand)] text-[2.75rem] leading-none text-[#1d1b18]/85">{o.ownerName}</p>}
      </article>

      <section className="print-break mt-20" aria-labelledby="guide-title">
        <h2 id="guide-title" className="t-display text-[clamp(2rem,4.5vw,2.6rem)] leading-[1.05]">
          The recovery guide
        </h2>
        <p className="mt-3 text-fg-2">
          {o.guide.length} {o.guide.length === 1 ? "wallet" : "wallets"}
          {total > 0 ? `, about ${formatUsd(total)} at today's prices` : ""}. Work through them one at a time.
        </p>
        {b.scanError && (
          <p className="mt-5 flex gap-2 rounded-lg bg-amber-wash px-4 py-3 text-[0.8125rem] text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Live balances couldn&rsquo;t be read just now ({b.scanError}). The notes below still apply.
          </p>
        )}

        <div className="mt-8 space-y-6">
          {o.guide.map((w, wi) => {
            const value = w.assets.reduce((s, g) => s + (g.asset.usd ?? 0), 0);
            return (
              <article key={w.walletId} className="card print-avoid overflow-hidden" aria-label={w.label}>
                <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="t-num text-[0.9375rem] text-fg-3">{wi + 1}.</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[1.15rem] font-semibold tracking-[-0.01em]">{w.label}</span>
                      <span className="block text-[0.8125rem] text-fg-3">{w.chain === "sui" ? "Sui" : "Ethereum"} wallet</span>
                    </span>
                  </span>
                  {value > 0 && <span className="t-num text-[1.15rem] font-semibold">{formatUsd(value)}</span>}
                </header>
                <div className="px-5 pb-5 sm:px-7 sm:pb-6">
                  <div className="sunk mt-4 flex items-center gap-1 py-1 pr-1 pl-3">
                    <span className="t-mono min-w-0 flex-1 truncate text-[0.75rem] text-fg-2 print:whitespace-normal print:break-all">{w.address}</span>
                    <CopyButton value={w.address} label="Copy address" />
                  </div>
                  <dl className="mt-2 divide-y divide-line">
                    <Note label="Where the key is" value={w.where} />
                    <Note label="How to open it" value={w.how} />
                    <Note label="Who it's for" value={w.who} />
                  </dl>
                  {w.assets.length > 0 ? (
                    <ul className="mt-2 divide-y divide-line border-t border-line">
                      {w.assets.map((g) => (
                        <li key={g.asset.key} className="print-avoid py-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-3">
                              <Coin a={g.asset} />
                              <span>
                                <span className="block font-medium">
                                  {g.asset.kind === "stake" ? "Staked " : ""}
                                  {formatAmount(g.asset.amount, g.asset.symbol)}
                                </span>
                                {g.asset.meta.validatorName && <span className="block text-[0.78rem] text-fg-3">with {g.asset.meta.validatorName}</span>}
                              </span>
                            </span>
                            <span className="t-num text-fg-2">{g.asset.usd !== null ? formatUsd(g.asset.usd) : "no price"}</span>
                          </div>
                          {(g.how || g.who) && (
                            <dl className="mt-2 divide-y divide-line">
                              {g.how && <Note label="How, for this one" value={g.how} />}
                              {g.who && <Note label="Who, for this one" value={g.who} />}
                            </dl>
                          )}
                          <ol className="mt-3 space-y-2">
                            {g.steps.map((s, i) => (
                              <li key={s} className="flex gap-3 text-[0.875rem] text-fg-2">
                                <span className="t-num w-4 shrink-0 text-right text-fg-3">{i + 1}</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="border-t border-line pt-4 text-[0.875rem] text-fg-3">Nothing in this wallet right now. Keep the notes; things sometimes arrive later.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {o.orphans.length > 0 && (
          <div className="card mt-6 p-5 sm:p-7">
            <h3 className="font-semibold">Notes about things no longer on-chain</h3>
            <ul className="mt-3 divide-y divide-line text-[0.875rem]">
              {o.orphans.map((f) => (
                <li key={`${f.target}:${f.field}`} className="py-2.5">
                  <span className="text-fg-3">
                    {f.field}, {shortAddress(f.target.split(":")[1] ?? f.target)}:
                  </span>{" "}
                  {f.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="print-avoid mt-8 rounded-xl bg-amber-wash p-5 sm:p-7" aria-labelledby="careful">
        <h2 id="careful" className="flex items-center gap-2 font-semibold text-amber">
          <ShieldAlert className="size-4" aria-hidden="true" /> Before you move anything
        </h2>
        <ul className="mt-3 space-y-2 text-[0.875rem] text-fg-2">
          <li>Send a small test amount first, and check it arrives before sending the rest.</li>
          <li>No one genuine needs a wallet&rsquo;s recovery phrase from you: not support staff, not an exchange, not us. If someone asks, stop.</li>
          <li>Inheritance has legal and tax sides. A lawyer or notary can tell you what applies where you live.</li>
        </ul>
      </aside>
      <Audit b={b} className="mt-5" />
    </div>
  );
}
