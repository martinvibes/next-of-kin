"use client";

import { useEffect, useState } from "react";
import { decryptFieldOrNull, unlockVault } from "@/domain/crypto";
import { formatAmount, formatUsd, relativeTime } from "@/domain/format";
import { buildGuide, orphanedAssetFacts, type DecryptedFact, type DecryptedWallet, type GuideWallet } from "@/domain/heir";
import { shortAddress } from "@/domain/ids";
import type { HeirBundleResponse, ReleasedBundle, SealedBundle, StatusResponse } from "@/lib/api-types";
import { api, ApiFailure } from "@/lib/client";
import { Seal } from "@/components/Seal";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BlobLink, CopyButton } from "@/components/Receipt";
import { countdown } from "@/components/owner/SwitchCard";

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
    <>
      <ModeBanner status={status} />
      <SiteHeader current="heir" />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {err ? (
          <p className="py-24 text-center text-ink-2" role="alert">
            {err}
          </p>
        ) : !bundle ? (
          <p className="py-24 text-center text-ink-2 animate-pulse-soft" role="status">
            Checking the seal…
          </p>
        ) : bundle.phase !== "released" ? (
          <Sealed b={bundle} />
        ) : opened ? (
          <Letter b={bundle} o={opened} fixtures={status?.chain.mode === "fixtures"} />
        ) : (
          <Envelope b={bundle} onOpen={setOpened} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
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
      <section className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
        <Seal size={180} value={0} tone="ink" label="Empty seal" />
        <h1 className="t-display mt-10 text-[clamp(2.2rem,5vw,3rem)] leading-tight">No letter has been written here yet.</h1>
        <p className="mt-4 text-ink-2">When someone prepares one for you on this deployment, this is where it will open.</p>
      </section>
    );

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center py-12 text-center">
      <Seal size={240} value={100} tone={b.phase === "overdue" ? "brass" : "ink"} label="Sealed letter">
        <span className="t-display text-3xl">Sealed</span>
      </Seal>
      <h1 className="t-display mt-10 text-[clamp(2.2rem,5vw,3.2rem)] leading-tight text-balance">
        {b.phase === "overdue" ? "The owner has missed a check-in." : "This letter is still sealed."}
      </h1>
      <p className="mt-4 max-w-lg text-ink-2">
        {b.phase === "overdue"
          ? "A grace period has started. If they don't check in, and their Sui wallets stay quiet, the letter opens here."
          : "It opens only if the owner stops checking in and their Sui wallets go quiet for the whole interval. Nothing inside can be read until then."}
      </p>
      <dl className="mt-10 grid w-full max-w-md grid-cols-2 gap-6 border-t border-rule pt-6 text-left text-sm">
        <div>
          <dt className="text-ink-3">Last sign of life</dt>
          <dd className="mt-1 text-[0.9375rem]">
            {sw.lastAlive ? relativeTime(sw.lastAlive, new Date(now).toISOString()) : "—"}
            <span className="block text-xs text-ink-2">{sw.lastAliveSource === "onchain" ? "an on-chain transaction, via Tatum" : sw.lastAliveSource === "checkin" ? "a check-in" : sw.lastAliveSource === "profile" ? "when the vault was set up" : ""}</span>
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Opens, at the earliest</dt>
          <dd className={`t-num mt-1 text-[0.9375rem] ${b.phase === "overdue" ? "text-amber" : ""}`}>
            {opensIn !== null ? (opensIn > 0 ? `in ${countdown(opensIn)}` : "any moment") : "—"}
            {sw.releaseAt && <span className="block text-xs text-ink-2">{fmtDate(sw.releaseAt)}</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Envelope({ b, onOpen }: { b: ReleasedBundle; onOpen: (o: Opened) => void }) {
  const [pass, setPass] = useState("");
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
    <section className="mx-auto grid max-w-5xl items-center gap-14 py-10 md:grid-cols-[0.9fr_1.1fr]">
      <div className="flex justify-center">
        <Seal size={260} value={100} tone="claret" label="Broken seal">
          <span className="t-display text-3xl">Released</span>
        </Seal>
      </div>
      <div>
        <form onSubmit={open} className="sheet p-7 sm:p-10" aria-labelledby="env-title">
          <h1 id="env-title" className="t-display text-[clamp(2rem,4vw,2.6rem)] leading-tight">
            A letter has been left for you.
          </h1>
          <p className="mt-3 text-ink-2">It&rsquo;s encrypted. The passphrase was written down for you, often kept with a will or in a safe place. It never leaves this browser.</p>
          <label htmlFor="heir-pass" className="label mt-8">
            Passphrase
          </label>
          <input id="heir-pass" className="field" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus required />
          {err && (
            <p className="mt-4 rounded-lg bg-claret-wash px-3 py-2 text-sm text-claret" role="alert">
              {err}
            </p>
          )}
          <button className="btn btn-primary mt-8" disabled={busy || !pass}>
            {busy ? "Opening…" : "Open the letter"}
          </button>
        </form>
        <Audit b={b} className="mt-4" />
      </div>
    </section>
  );
}

function Audit({ b, className = "" }: { b: ReleasedBundle; className?: string }) {
  if (!b.audit) return null;
  const m = b.audit.memory;
  return (
    <div className={`stub flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-sheet-2 px-5 py-3.5 text-sm ${className}`}>
      <div className="min-w-0">
        <p className="font-medium">Released {fmtDate(m.ts)}</p>
        <p className="text-ink-2">
          {m.reason} {m.verifiedVia === "tatum" ? "Verified on-chain via Tatum." : m.verifiedVia === "checkins" ? "Based on missed check-ins." : ""}
        </p>
      </div>
      {b.audit.blobId ? <BlobLink blobId={b.audit.blobId} mock={b.audit.blobId.startsWith("mock")} /> : <span className="text-ink-2">Writing to Walrus…</span>}
    </div>
  );
}

function Note({ label, value }: { label: string; value?: string }) {
  return (
    <div className="print-avoid">
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className={`mt-1 whitespace-pre-wrap ${value ? "t-letter text-[1.05rem] leading-relaxed" : "text-sm text-ink-3"}`}>{value ?? "Not written down. Look through their devices and papers."}</dd>
    </div>
  );
}

function Letter({ b, o, fixtures }: { b: ReleasedBundle; o: Opened; fixtures: boolean }) {
  const total = b.assets.reduce((s, a) => s + (a.usd ?? 0), 0);
  return (
    <div className="mx-auto max-w-3xl pb-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Decrypted in this browser.{" "}
          {fixtures ? "Balances are fixture data on this deployment, not live." : `Balances read ${b.scannedAt ? relativeTime(b.scannedAt, new Date().toISOString()) : "—"} from Mainnet through Tatum.`}
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          Print this guide
        </button>
      </div>

      <article className="sheet px-7 py-10 sm:px-14 sm:py-14" aria-labelledby="letter-to">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-rule-soft pb-6">
          <div>
            <p id="letter-to" className="t-serif text-[1.2rem]">
              For {o.heirName ?? "you"}
            </p>
            {o.heirContact && <p className="text-sm text-ink-2">{o.heirContact}</p>}
          </div>
          <p className="text-sm text-ink-2">{b.letter ? new Date(b.letter.ts).toLocaleDateString(undefined, { dateStyle: "long" }) : ""}</p>
        </header>
        {o.letter ? (
          <div className="t-letter mt-8 text-[1.15rem] leading-[1.85] whitespace-pre-wrap">{o.letter}</div>
        ) : (
          <p className="t-letter mt-8 text-[1.15rem] text-ink-2">No personal letter was written. The guide below is everything they recorded.</p>
        )}
        {o.ownerName && <p className="mt-8 font-[family-name:var(--font-hand)] text-[2.6rem] leading-none text-ink">{o.ownerName}</p>}
      </article>

      <section className="print-break mt-16" aria-labelledby="guide-title">
        <h2 id="guide-title" className="t-display text-[clamp(1.9rem,4vw,2.6rem)] leading-tight">
          The recovery guide
        </h2>
        <p className="mt-2 text-ink-2">
          {o.guide.length} {o.guide.length === 1 ? "wallet" : "wallets"}
          {total > 0 ? `, about ${formatUsd(total)} at today's prices` : ""}. Work through them one at a time.
        </p>
        {b.scanError && <p className="mt-3 rounded-lg bg-amber-wash px-4 py-2.5 text-sm text-amber">Live balances couldn&rsquo;t be read just now ({b.scanError}). The notes below still apply.</p>}

        <div className="mt-8 space-y-8">
          {o.guide.map((w) => (
            <article key={w.walletId} className="sheet print-avoid p-6 sm:p-9" aria-label={w.label}>
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="t-serif text-[1.5rem] leading-tight">{w.label}</h3>
                <span className="text-sm text-ink-2">{w.chain === "sui" ? "Sui" : "Ethereum"} wallet</span>
              </header>
              <p className="mt-2 flex items-center gap-2">
                <span className="t-mono text-[0.8rem] break-all text-ink-2">{w.address}</span>
                <CopyButton value={w.address} label="Copy address" />
              </p>
              <dl className="mt-7 grid gap-6 sm:grid-cols-3">
                <Note label="Where the key is" value={w.where} />
                <Note label="How to open it" value={w.how} />
                <Note label="Who it's for" value={w.who} />
              </dl>
              {w.assets.length > 0 ? (
                <ul className="mt-8 space-y-6 border-t border-rule-soft pt-6">
                  {w.assets.map((g) => (
                    <li key={g.asset.key} className="print-avoid">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold">
                          {g.asset.kind === "stake" ? "Staked " : ""}
                          {formatAmount(g.asset.amount, g.asset.symbol)}
                          {g.asset.meta.validatorName && <span className="font-normal text-ink-2"> with {g.asset.meta.validatorName}</span>}
                        </p>
                        <p className="t-num text-ink-2">{g.asset.usd !== null ? formatUsd(g.asset.usd) : "no price"}</p>
                      </div>
                      {(g.how || g.who) && (
                        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                          {g.how && <Note label="How (for this one)" value={g.how} />}
                          {g.who && <Note label="Who (for this one)" value={g.who} />}
                        </dl>
                      )}
                      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[0.9375rem] marker:text-ink-3">
                        {g.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-8 border-t border-rule-soft pt-6 text-sm text-ink-2">Nothing in this wallet right now. Keep the notes; things sometimes arrive later.</p>
              )}
            </article>
          ))}
        </div>

        {o.orphans.length > 0 && (
          <div className="mt-8 rounded-xl bg-sheet-2 p-6">
            <h3 className="font-semibold">Notes about things no longer on-chain</h3>
            <ul className="mt-3 space-y-2 text-[0.9375rem]">
              {o.orphans.map((f) => (
                <li key={`${f.target}:${f.field}`}>
                  <span className="text-ink-2">
                    {f.field} · {shortAddress(f.target.split(":")[1] ?? f.target)}:
                  </span>{" "}
                  {f.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="print-avoid mt-12 rounded-xl border border-rule p-6 sm:p-8" aria-labelledby="careful">
        <h2 id="careful" className="t-serif text-[1.3rem]">
          Before you move anything
        </h2>
        <ul className="mt-4 space-y-2.5 text-[0.9375rem] text-ink-2">
          <li>Nobody legitimate will ask you for a recovery phrase. Not support staff, not an exchange, not us.</li>
          <li>Send a small test amount first, and check it arrives before sending the rest.</li>
          <li>Inheritance has legal and tax sides. A lawyer or notary can tell you what applies where you live.</li>
        </ul>
      </aside>
      <Audit b={b} className="mt-6" />
    </div>
  );
}
