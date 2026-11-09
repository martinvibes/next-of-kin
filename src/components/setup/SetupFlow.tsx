"use client";

import { useEffect, useRef, useState } from "react";
import { createVault, encryptField, passphraseStrength } from "@/domain/crypto";
import { newId } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import { graceFor, INTERVAL_PRESETS, type ProfileMemory, type VaultMemory } from "@/domain/types";
import { formatInterval } from "@/domain/format";
import type { StateResponse, StatusResponse, WriteResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret, setOwnerSecret } from "@/lib/client";
import { Seal } from "@/components/Seal";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Dashboard } from "@/components/owner/Dashboard";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["Owner key", "Names", "Passphrase", "Check-ins"] as const;

export function SetupFlow() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [secret, setSecret] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [heirName, setHeirName] = useState("");
  const [heirContact, setHeirContact] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [wrote, setWrote] = useState(false);
  const [interval, setIntervalSec] = useState<number>(INTERVAL_PRESETS[2].sec);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ key: CryptoKey; status: StatusResponse } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    api<StatusResponse>("/api/status").then(setStatus).catch(() => {});
    const s = getOwnerSecret();
    if (s) {
      api<StateResponse>("/api/state", { secret: s })
        .then(() => {
          setSecret(s);
          setStep((x) => (x === 0 ? 1 : x));
        })
        .catch(() => setOwnerSecret(null));
    }
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (done)
    return (
      <>
        <ModeBanner status={done.status} />
        <Dashboard cryptoKey={done.key} status={done.status} onLock={() => (window.location.href = "/owner")} />
      </>
    );

  if (status?.setup)
    return (
      <Frame status={status}>
        <div className="mx-auto max-w-lg py-16 text-center">
          <h1 className="t-display text-[2.6rem] leading-tight">This vault is already sealed.</h1>
          <p className="mt-4 text-ink-2">One vault per deployment. Open it with your passphrase to keep going.</p>
          <a href="/owner" className="btn btn-primary mt-8">
            Open my vault
          </a>
        </div>
      </Frame>
    );

  const strength = passphraseStrength(pass);
  const nameSecret = [ownerName, heirName, heirContact].some((t) => detectSecret(t).blocked);
  const passSecret = detectSecret(pass).blocked;

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (step === 0) {
      setBusy(true);
      try {
        await api<StateResponse>("/api/state", { secret: secret.trim() });
        setOwnerSecret(secret.trim());
        setStep(1);
      } catch (e) {
        setErr(e instanceof ApiFailure && e.status === 401 ? "That isn't this deployment's owner key." : e instanceof Error ? e.message : "Couldn't check the key.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 1) {
      if (nameSecret) return setErr(SECRET_MESSAGE);
      return setStep(2);
    }
    if (step === 2) {
      if (passSecret) return setErr("Use a passphrase you made up, not a wallet's recovery phrase.");
      if (strength.score < 2) return setErr("Make it a little longer. Four or more ordinary words works well.");
      if (pass !== pass2) return setErr("The two passphrases don't match.");
      if (!wrote) return setErr("Tick the box once it's written down. Nobody can recover it for you.");
      return setStep(3);
    }
    await seal();
  }

  async function seal() {
    setBusy(true);
    setErr(null);
    try {
      const { vault, key } = await createVault(pass);
      const now = () => new Date().toISOString();
      const vm: VaultMemory = { v: 1, id: newId(), kind: "vault", ts: now(), ...vault };
      await api<WriteResponse>("/api/memories", { owner: true, body: { memory: vm } });
      const pm: ProfileMemory = {
        v: 1,
        id: newId(),
        kind: "profile",
        ts: now(),
        ownerName: await encryptField(key, ownerName.trim()),
        heirName: await encryptField(key, heirName.trim()),
        heirContact: await encryptField(key, heirContact.trim()),
        intervalSec: interval,
        graceSec: graceFor(interval),
      };
      await api<WriteResponse>("/api/memories", { owner: true, body: { memory: pm } });
      const st = await api<StatusResponse>("/api/status");
      window.history.replaceState(null, "", "/owner");
      setDone({ key, status: st });
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Couldn't seal the vault. Nothing was half-saved; try again.");
    } finally {
      setBusy(false);
    }
  }

  const heir = heirName.trim() || "your heir";

  return (
    <Frame status={status}>
      <div className="grid items-start gap-12 pt-6 pb-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
        <aside className="hidden flex-col items-center md:flex md:sticky md:top-8" aria-hidden="true">
          <Seal size={260} value={step * 25 + (busy && step === 3 ? 25 : 0)} tone="brass" label="Setup progress">
            <span className="t-display t-num text-5xl">{step}/4</span>
            <span className="mt-1 text-sm text-ink-2">sealed</span>
          </Seal>
          <ol className="mt-10 w-full max-w-[16rem] space-y-2.5 text-[0.9375rem]">
            {STEPS.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 ${i === step ? "text-ink" : i < step ? "text-ink-2" : "text-ink-3"}`}>
                <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${i < step ? "bg-ink text-sheet" : i === step ? "ring-1 ring-ink" : "ring-1 ring-rule"}`}>{i < step ? "✓" : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </aside>

        <form onSubmit={next} className="sheet p-6 sm:p-10" aria-labelledby="step-title" noValidate>
          <p className="text-sm text-ink-2 md:hidden">
            Step {step + 1} of 4 · {STEPS[step]}
          </p>

          {step === 0 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="t-display text-[clamp(2rem,4vw,2.7rem)] leading-tight outline-none">
                Prove this deployment is yours
              </h1>
              <p className="mt-3 text-ink-2">Paste the OWNER_SECRET you set on the server. It&rsquo;s kept for this browser session only.</p>
              <label htmlFor="secret" className="label mt-8">
                Owner key
              </label>
              <input id="secret" className="field" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} autoFocus />
            </>
          )}

          {step === 1 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="t-display text-[clamp(2rem,4vw,2.7rem)] leading-tight outline-none">
                Who is this letter for?
              </h1>
              <p className="mt-3 text-ink-2">Names are encrypted in this browser. The server only ever sees ciphertext.</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="owner-name" className="label">
                    Your name
                  </label>
                  <input id="owner-name" className="field" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Tomás Reyes" autoComplete="name" maxLength={80} autoFocus />
                </div>
                <div>
                  <label htmlFor="heir-name" className="label">
                    Your heir
                  </label>
                  <input id="heir-name" className="field" value={heirName} onChange={(e) => setHeirName(e.target.value)} placeholder="Ada Reyes" maxLength={80} />
                </div>
              </div>
              <label htmlFor="heir-contact" className="label mt-5">
                How should they be reached?
              </label>
              <input id="heir-contact" className="field" value={heirContact} onChange={(e) => setHeirContact(e.target.value)} placeholder="ada@example.com, or through our lawyer at Reyes & Hart" maxLength={200} />
              <p className="help">Shown to {heir} inside the released letter, so they know who to call.</p>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="t-display text-[clamp(2rem,4vw,2.7rem)] leading-tight outline-none">
                Choose the passphrase {heir} will use
              </h1>
              <p className="mt-3 text-ink-2">
                It encrypts everything you write here, and it&rsquo;s the only way to open the letter. Make one up. Never use a wallet&rsquo;s recovery phrase.
              </p>
              <label htmlFor="pass" className="label mt-8">
                Passphrase
              </label>
              <input id="pass" className="field" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus aria-describedby="pass-strength" />
              <div className="mt-2 flex items-center gap-3" id="pass-strength">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full ${pass && strength.score > i ? (strength.score === 3 ? "bg-moss" : strength.score === 2 ? "bg-brass" : "bg-claret") : "bg-rule-soft"}`} />
                  ))}
                </div>
                <span className="w-48 text-right text-xs text-ink-2">{pass ? (passSecret ? "Looks like a recovery phrase" : strength.label) : "Four ordinary words is plenty"}</span>
              </div>
              <label htmlFor="pass2" className="label mt-5">
                Once more
              </label>
              <input id="pass2" className="field" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} aria-invalid={!!pass2 && pass !== pass2} />
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg bg-brass-wash px-4 py-3 text-[0.9375rem]">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--brass)]" checked={wrote} onChange={(e) => setWrote(e.target.checked)} />
                <span>
                  I&rsquo;ve written it down where {heir} will find it, such as with my will. <span className="text-ink-2">Nobody, including us, can recover it.</span>
                </span>
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className="t-display text-[clamp(2rem,4vw,2.7rem)] leading-tight outline-none">
                How long before {heir} should read it?
              </h1>
              <p className="mt-3 text-ink-2">If you don&rsquo;t check in, and none of your Sui wallets send a transaction, the letter opens after this long plus a 25% grace period.</p>
              <fieldset className="mt-8 grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Check-in interval</legend>
                {INTERVAL_PRESETS.map((p) => (
                  <label
                    key={p.sec}
                    className={`relative cursor-pointer rounded-xl px-5 py-4 transition-shadow ${interval === p.sec ? "bg-sheet shadow-[0_0_0_2px_var(--ink)]" : "bg-sheet-2 shadow-[0_0_0_1px_var(--rule)] hover:shadow-[0_0_0_1px_var(--ink-3)]"}`}
                  >
                    <input type="radio" name="interval" className="sr-only" checked={interval === p.sec} onChange={() => setIntervalSec(p.sec)} />
                    <span className="t-serif block text-[1.2rem]">{p.label}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{p.demo ? "Demo: try the whole switch in minutes" : `then ${formatInterval(graceFor(p.sec))} grace`}</span>
                    {p.demo && <span className="absolute top-3 right-3 rounded bg-amber-wash px-1.5 py-0.5 text-[0.7rem] font-semibold text-amber">demo</span>}
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {err && (
            <p className="mt-6 rounded-lg bg-claret-wash px-3 py-2 text-sm text-claret" role="alert">
              {err}
            </p>
          )}

          <div className="mt-10 flex items-center gap-3">
            <button className="btn btn-primary" disabled={busy || (step === 0 && !secret.trim()) || (step === 1 && (!ownerName.trim() || !heirName.trim() || !heirContact.trim()))}>
              {busy ? (step === 3 ? "Sealing on Walrus…" : "Checking…") : step === 3 ? "Seal the vault" : "Continue"}
            </button>
            {step > (getOwnerSecret() ? 1 : 0) && (
              <button type="button" className="btn btn-quiet" onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
                Back
              </button>
            )}
          </div>
        </form>
      </div>
    </Frame>
  );
}

function Frame({ status, children }: { status: StatusResponse | null; children: React.ReactNode }) {
  return (
    <>
      <ModeBanner status={status} />
      <SiteHeader current="setup" />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
