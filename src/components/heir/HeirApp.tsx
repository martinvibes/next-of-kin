"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, HeartPulse, KeyRound, Lock, MailOpen, Printer, ScrollText, ShieldAlert, UserRound, Wrench } from "lucide-react";
import { decryptFieldOrNull, unlockVault } from "@/domain/crypto";
import { formatAmount, formatInterval, formatUsd, relativeTime } from "@/domain/format";
import { buildGuide, orphanedAssetFacts, type DecryptedFact, type DecryptedWallet, type GuideWallet } from "@/domain/heir";
import { shortAddress } from "@/domain/ids";
import type { HeirBundleResponse, ReleasedBundle, SealedBundle, StatusResponse } from "@/lib/api-types";
import { api, ApiFailure } from "@/lib/client";
import { countdown, useNow } from "@/lib/time";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BlobLink, CopyButton } from "@/components/Receipt";
import { AssetAvatar } from "@/components/owner/Ledger";

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
    <div className="aurora min-h-dvh">
      <ModeBanner status={status} />
      <SiteHeader current="heir" />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {err ? (
          <p className="py-24 text-center text-fg-2" role="alert">
            {err}
          </p>
        ) : !bundle ? (
          <div className="mx-auto max-w-lg py-24" role="status">
            <div className="skeleton mx-auto size-16 rounded-2xl" />
            <div className="skeleton mx-auto mt-6 h-7 w-64" />
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
      <section className="mx-auto flex max-w-lg flex-col items-center py-20 text-center animate-rise">
        <span className="grid size-16 place-items-center rounded-2xl border border-line-2 bg-panel text-fg-3">
          <MailOpen className="size-7" />
        </span>
        <h1 className="mt-7 text-[clamp(1.7rem,4vw,2.3rem)] leading-tight font-semibold tracking-[-0.03em]">No letter has been written here yet</h1>
        <p className="mt-3 text-fg-2">When someone prepares one for you on this deployment, this is where it will open.</p>
      </section>
    );

  const overdue = b.phase === "overdue";
  const start = sw.lastAlive ? Date.parse(sw.lastAlive) : null;
  const end = sw.releaseAt ? Date.parse(sw.releaseAt) : null;
  const frac = start && end && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center animate-rise sm:py-20">
      <span className={`relative grid size-20 place-items-center rounded-3xl border ${overdue ? "border-amber/30 bg-amber-wash text-amber" : "border-mint/25 bg-mint-wash text-mint"}`}>
        <Lock className="size-8" />
        <span className={`absolute -inset-3 rounded-[28px] border ${overdue ? "border-amber/15" : "border-mint/10"}`} aria-hidden="true" />
      </span>
      <span className={`pill mt-8 ${overdue ? "pill-amber" : "pill-mint"}`}>{overdue ? "Check-in missed" : "Sealed"}</span>
      <h1 className="mt-4 text-[clamp(1.8rem,4.5vw,2.7rem)] leading-[1.1] font-semibold tracking-[-0.035em]">{overdue ? "The owner has missed a check-in" : "This letter is still sealed"}</h1>
      <p className="mt-4 max-w-lg text-fg-2">
        {overdue
          ? "A grace period has started. If they don't check in, and their Sui wallets stay quiet, the letter opens here."
          : "It opens only if the owner stops checking in and their Sui wallets go quiet for the whole interval. Nothing inside can be read until then."}
      </p>

      <div className="card mt-10 w-full max-w-lg p-5 text-left">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="flex items-center gap-1.5 text-[0.75rem] text-fg-3">
              <HeartPulse className="size-3.5" /> Last sign of life
            </p>
            <p className="mt-1 font-semibold">{sw.lastAlive ? relativeTime(sw.lastAlive, new Date(now).toISOString()) : "—"}</p>
            <p className="text-[0.72rem] text-fg-3">{sw.lastAliveSource === "onchain" ? "An on-chain transaction, via Tatum" : sw.lastAliveSource === "checkin" ? "A check-in" : sw.lastAliveSource === "profile" ? "When the vault was set up" : ""}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[0.75rem] text-fg-3">
              <MailOpen className="size-3.5" /> Opens, at the earliest
            </p>
            <p className={`t-num mt-1 font-semibold ${overdue ? "text-amber" : ""}`}>{opensIn !== null ? (opensIn > 0 ? `in ${countdown(opensIn)}` : "any moment") : "—"}</p>
            {sw.releaseAt && <p className="text-[0.72rem] text-fg-3">{fmtDate(sw.releaseAt)}</p>}
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
          <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${overdue ? "bg-amber" : "bg-mint"}`} style={{ width: `${frac * 100}%` }} />
        </div>
        <p className="mt-2 text-[0.72rem] text-fg-3">
          Owner checks in every {formatInterval(sw.intervalSec)}, then {formatInterval(sw.graceSec)} grace.
        </p>
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
    <section className="mx-auto max-w-[440px] py-16 animate-rise sm:py-20">
      <form onSubmit={open} className="card glow-mint p-7 sm:p-8" aria-labelledby="env-title">
        <span className="grid size-12 place-items-center rounded-2xl bg-mint-wash text-mint">
          <MailOpen className="size-6" />
        </span>
        <h1 id="env-title" className="mt-6 text-[1.6rem] leading-tight font-semibold tracking-[-0.03em]">
          A letter has been left for you
        </h1>
        <p className="mt-2 text-[0.875rem] text-fg-2">It&rsquo;s encrypted. The passphrase was written down for you, often kept with a will or in a safe place. It never leaves this browser.</p>
        <label htmlFor="heir-pass" className="label mt-7">
          Passphrase
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
          <input id="heir-pass" className="input !pr-11 !pl-9" type={show ? "text" : "password"} autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus required />
          <button type="button" className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:text-fg" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passphrase" : "Show passphrase"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {err && (
          <p className="mt-4 rounded-lg border border-rose/20 bg-rose-wash px-3 py-2 text-[0.8125rem] text-rose" role="alert">
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

const NOTE_ICON = { where: KeyRound, how: Wrench, who: UserRound } as const;

function Note({ field, label, value }: { field: keyof typeof NOTE_ICON; label: string; value?: string }) {
  const Icon = NOTE_ICON[field];
  return (
    <div className={`print-avoid rounded-xl border p-4 ${value ? "border-line bg-bg-2" : "border-dashed border-line-2"}`}>
      <dt className="flex items-center gap-2 text-[0.75rem] font-medium text-fg-3">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className={`mt-2 whitespace-pre-wrap ${value ? "text-[0.9375rem] leading-relaxed text-fg" : "text-[0.8125rem] text-fg-3"}`}>{value ?? "Not written down. Look through their devices and papers."}</dd>
    </div>
  );
}

function Letter({ b, o, fixtures }: { b: ReleasedBundle; o: Opened; fixtures: boolean }) {
  const total = b.assets.reduce((s, a) => s + (a.usd ?? 0), 0);
  return (
    <div className="mx-auto max-w-3xl py-10 animate-rise">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[0.8125rem] text-fg-2">
          <Lock className="size-3.5 text-mint" />
          Decrypted in this browser.{" "}
          {fixtures ? "Balances are fixture data on this deployment, not live." : `Balances read ${b.scannedAt ? relativeTime(b.scannedAt, new Date().toISOString()) : "—"} from Mainnet through Tatum.`}
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          <Printer /> Print this guide
        </button>
      </div>

      <article className="paper px-7 py-10 sm:px-14 sm:py-14" aria-labelledby="letter-to">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-black/10 pb-6">
          <div>
            <p id="letter-to" className="t-letter text-[1.2rem] text-[#1b1f27]">
              For {o.heirName ?? "you"}
            </p>
            {o.heirContact && <p className="text-[0.8125rem] text-black/55">{o.heirContact}</p>}
          </div>
          <p className="text-[0.8125rem] text-black/55">{b.letter ? new Date(b.letter.ts).toLocaleDateString(undefined, { dateStyle: "long" }) : ""}</p>
        </header>
        {o.letter ? (
          <div className="t-letter mt-8 text-[1.12rem] leading-[1.85] whitespace-pre-wrap text-[#1b1f27]">{o.letter}</div>
        ) : (
          <p className="t-letter mt-8 text-[1.1rem] text-black/55">No personal letter was written. The guide below is everything they recorded.</p>
        )}
        {o.ownerName && <p className="mt-8 font-[family-name:var(--font-hand)] text-[2.6rem] leading-none text-[#1b1f27]/85">{o.ownerName}</p>}
      </article>

      <section className="print-break mt-16" aria-labelledby="guide-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="guide-title" className="flex items-center gap-2.5 text-[1.6rem] font-semibold tracking-[-0.03em]">
              <ScrollText className="size-6 text-mint" aria-hidden="true" /> The recovery guide
            </h2>
            <p className="mt-1 text-fg-2">
              {o.guide.length} {o.guide.length === 1 ? "wallet" : "wallets"}
              {total > 0 ? `, about ${formatUsd(total)} at today's prices` : ""}. Work through them one at a time.
            </p>
          </div>
        </div>
        {b.scanError && (
          <p className="mt-4 flex gap-2 rounded-xl border border-amber/20 bg-amber-wash px-4 py-3 text-[0.8125rem] text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Live balances couldn&rsquo;t be read just now ({b.scanError}). The notes below still apply.
          </p>
        )}

        <div className="mt-6 space-y-5">
          {o.guide.map((w, wi) => {
            const value = w.assets.reduce((s, g) => s + (g.asset.usd ?? 0), 0);
            return (
              <article key={w.walletId} className="card print-avoid overflow-hidden" aria-label={w.label}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="t-num grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[0.75rem] font-semibold text-fg-2">{wi + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[1.05rem] font-semibold">{w.label}</span>
                      <span className="block text-[0.75rem] text-fg-3">{w.chain === "sui" ? "Sui" : "Ethereum"} wallet</span>
                    </span>
                  </span>
                  {value > 0 && <span className="t-num text-[1.05rem] font-semibold">{formatUsd(value)}</span>}
                </header>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-1 rounded-lg border border-line bg-bg-2 py-1 pr-1 pl-3">
                    <span className="t-mono min-w-0 flex-1 truncate text-[0.75rem] text-fg-2 print:whitespace-normal print:break-all">{w.address}</span>
                    <CopyButton value={w.address} label="Copy address" />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Note field="where" label="Where the key is" value={w.where} />
                    <Note field="how" label="How to open it" value={w.how} />
                    <Note field="who" label="Who it's for" value={w.who} />
                  </dl>
                  {w.assets.length > 0 ? (
                    <ul className="mt-5 space-y-4 border-t border-line pt-5">
                      {w.assets.map((g) => (
                        <li key={g.asset.key} className="print-avoid">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-3">
                              <AssetAvatar a={g.asset} />
                              <span>
                                <span className="block font-medium">
                                  {g.asset.kind === "stake" ? "Staked " : ""}
                                  {formatAmount(g.asset.amount, g.asset.symbol)}
                                </span>
                                {g.asset.meta.validatorName && <span className="block text-[0.75rem] text-fg-3">with {g.asset.meta.validatorName}</span>}
                              </span>
                            </span>
                            <span className="t-num text-fg-2">{g.asset.usd !== null ? formatUsd(g.asset.usd) : "no price"}</span>
                          </div>
                          {(g.how || g.who) && (
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                              {g.how && <Note field="how" label="How, for this one" value={g.how} />}
                              {g.who && <Note field="who" label="Who, for this one" value={g.who} />}
                            </dl>
                          )}
                          <ol className="mt-3 space-y-1.5">
                            {g.steps.map((s, i) => (
                              <li key={s} className="flex gap-3 text-[0.875rem] text-fg-2">
                                <span className="t-num mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-mint-wash text-[0.68rem] font-semibold text-mint">{i + 1}</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 border-t border-line pt-5 text-[0.8125rem] text-fg-3">Nothing in this wallet right now. Keep the notes; things sometimes arrive later.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {o.orphans.length > 0 && (
          <div className="card mt-5 p-5 sm:p-6">
            <h3 className="font-semibold">Notes about things no longer on-chain</h3>
            <ul className="mt-3 space-y-2 text-[0.875rem]">
              {o.orphans.map((f) => (
                <li key={`${f.target}:${f.field}`}>
                  <span className="text-fg-3">
                    {f.field} · {shortAddress(f.target.split(":")[1] ?? f.target)}:
                  </span>{" "}
                  {f.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="print-avoid mt-8 rounded-2xl border border-amber/20 bg-amber-wash p-5 sm:p-6" aria-labelledby="careful">
        <h2 id="careful" className="flex items-center gap-2 font-semibold text-amber">
          <ShieldAlert className="size-4" /> Before you move anything
        </h2>
        <ul className="mt-3 space-y-2 text-[0.875rem] text-fg-2">
          <li>Nobody legitimate will ask you for a recovery phrase. Not support staff, not an exchange, not us.</li>
          <li>Send a small test amount first, and check it arrives before sending the rest.</li>
          <li>Inheritance has legal and tax sides. A lawyer or notary can tell you what applies where you live.</li>
        </ul>
      </aside>
      <Audit b={b} className="mt-5" />
    </div>
  );
}
