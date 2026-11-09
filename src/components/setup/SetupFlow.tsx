"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { createVault, encryptField, passphraseStrength } from "@/domain/crypto";
import { newId } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import { graceFor, INTERVAL_PRESETS, type ProfileMemory, type VaultMemory } from "@/domain/types";
import { formatInterval } from "@/domain/format";
import type { StateResponse, StatusResponse, WriteResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret, setOwnerSecret } from "@/lib/client";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { ModeBanner } from "@/components/ModeBanner";
import { Dashboard } from "@/components/owner/Dashboard";

type Step = 0 | 1 | 2 | 3;
const STEPS: { title: string }[] = [{ title: "Owner key" }, { title: "Names" }, { title: "Passphrase" }, { title: "Check-ins" }];

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
  const [minStep, setMinStep] = useState(0);

  useEffect(() => {
    api<StatusResponse>("/api/status").then(setStatus).catch(() => {});
    const s = getOwnerSecret();
    if (s) {
      api<StateResponse>("/api/state", { secret: s })
        .then(() => {
          setSecret(s);
          setMinStep(1);
          setStep((x) => (x === 0 ? 1 : x));
        })
        .catch(() => setOwnerSecret(null));
    }
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
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
      <AuthLayout status={status}>
        <div className="text-center animate-rise">
          <span className="pill pill-mint">
            <ShieldCheck /> Vault ready
          </span>
          <h1 className="t-display mt-5 text-[2.4rem] leading-[1.05]">This vault is already set up</h1>
          <p className="mt-3 text-[0.9375rem] text-fg-2">One vault per deployment. Open it with your passphrase to keep going.</p>
          <a href="/owner" className="btn btn-primary btn-lg mt-8 w-full">
            Open my vault <ArrowRight />
          </a>
        </div>
      </AuthLayout>
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
  const canContinue = !(busy || (step === 0 && !secret.trim()) || (step === 1 && (!ownerName.trim() || !heirName.trim() || !heirContact.trim())));
  const H = "t-display text-[2.2rem] leading-[1.05] outline-none sm:text-[2.6rem]";

  return (
    <AuthLayout status={status}>
      <form onSubmit={next} className="flex flex-col animate-rise" aria-labelledby="step-title" noValidate>
        <div className="flex items-center justify-between gap-3 text-[0.8125rem]">
          <p className="text-fg-3" aria-live="polite">
            Step {step + 1} of 4 <span className="text-fg-2">&nbsp;{STEPS[step].title}</span>
          </p>
          {step > minStep && (
            <button type="button" className="inline-flex items-center gap-1 text-fg-2 transition-colors hover:text-fg disabled:opacity-40" onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
              <ArrowLeft className="size-3.5" /> Back
            </button>
          )}
        </div>
        <div className="mt-3 h-[2px] overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full origin-left bg-fg transition-[width] duration-500 ease-out" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>

        <div key={step} className="mt-10 animate-rise">
          {step === 0 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className={H}>
                Prove this deployment is yours
              </h1>
              <p className="mt-3 text-[0.9375rem] text-fg-2">Paste the OWNER_SECRET you set on the server. It&rsquo;s kept for this browser session only.</p>
              <label htmlFor="secret" className="label mt-8">
                Owner key
              </label>
              <input id="secret" className="input" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} autoFocus />
            </>
          )}

          {step === 1 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className={H}>
                Who is this letter for?
              </h1>
              <p className="mt-3 text-[0.9375rem] text-fg-2">Names are encrypted in this browser before they&rsquo;re stored.</p>
              <div className="mt-8 space-y-4">
                <div>
                  <label htmlFor="owner-name" className="label">
                    Your name
                  </label>
                  <input id="owner-name" className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Tomás Reyes" autoComplete="name" maxLength={80} autoFocus />
                </div>
                <div>
                  <label htmlFor="heir-name" className="label">
                    Your heir
                  </label>
                  <input id="heir-name" className="input" value={heirName} onChange={(e) => setHeirName(e.target.value)} placeholder="Ada Reyes" maxLength={80} />
                </div>
                <div>
                  <label htmlFor="heir-contact" className="label">
                    How should they be reached?
                  </label>
                  <input id="heir-contact" className="input" value={heirContact} onChange={(e) => setHeirContact(e.target.value)} placeholder="ada@example.com, or through our lawyer" maxLength={200} />
                  <p className="help">Shown to {heir} inside the letter, so they know who to call.</p>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className={H}>
                Choose the passphrase {heir} will use
              </h1>
              <p className="mt-3 text-[0.9375rem] text-fg-2">It locks everything you write here, and it&rsquo;s the only way to open the letter.</p>
              <label htmlFor="pass" className="label mt-8">
                Passphrase
              </label>
              <input id="pass" className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus aria-describedby="pass-help pass-strength" />
              <div className="mt-2 flex items-center gap-3" id="pass-strength">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${pass && strength.score > i ? (passSecret ? "bg-rose" : "bg-fg") : "bg-line"}`} />
                  ))}
                </div>
                <span className={`min-w-24 text-right text-[0.75rem] ${passSecret ? "text-rose" : "text-fg-3"}`}>{pass ? (passSecret ? "Looks like a recovery phrase" : strength.label) : ""}</span>
              </div>
              <p id="pass-help" className="help">
                Make one up. Four ordinary words is plenty. It&rsquo;s not your wallet&rsquo;s recovery phrase.
              </p>
              <label htmlFor="pass2" className="label mt-5">
                Once more
              </label>
              <input id="pass2" className="input" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} aria-invalid={!!pass2 && pass !== pass2} />
              <label className="sunk mt-6 flex cursor-pointer items-start gap-3 px-4 py-3.5 text-[0.875rem]">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--fg)]" checked={wrote} onChange={(e) => setWrote(e.target.checked)} />
                <span>
                  I&rsquo;ve written it down where {heir} will find it, such as with my will. <span className="text-fg-2">Nobody, including us, can recover it.</span>
                </span>
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className={H}>
                How long before {heir} should read it?
              </h1>
              <p className="mt-3 text-[0.9375rem] text-fg-2">If you don&rsquo;t check in, and none of your Sui wallets send a transaction, the letter opens after this long plus a 25% grace period.</p>
              <fieldset className="card mt-8 divide-y divide-line overflow-hidden">
                <legend className="sr-only">Check-in interval</legend>
                {INTERVAL_PRESETS.map((p) => {
                  const on = interval === p.sec;
                  return (
                    <label key={p.sec} className={`flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors ${on ? "bg-panel-2" : "hover:bg-panel-2"}`}>
                      <input type="radio" name="interval" className="sr-only" checked={on} onChange={() => setIntervalSec(p.sec)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          {p.demo && <span className="pill pill-amber">Demo setting</span>}
                        </span>
                        <span className="mt-0.5 block text-[0.8125rem] text-fg-3">{p.demo ? "Try the whole switch in minutes" : `then ${formatInterval(graceFor(p.sec))} grace`}</span>
                      </span>
                      <span className={`grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors ${on ? "border-fg bg-fg" : "border-line-2 bg-panel"}`} aria-hidden="true">
                        {on && <Check className="size-3 text-white" strokeWidth={3} />}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}
        </div>

        {err && (
          <p className="mt-5 rounded-lg bg-rose-wash px-3.5 py-2.5 text-[0.8125rem] text-rose" role="alert">
            {err}
          </p>
        )}

        <button className="btn btn-primary btn-lg mt-8 w-full" disabled={!canContinue}>
          {busy ? (step === 3 ? "Sealing the vault…" : "Checking…") : step === 3 ? "Seal the vault" : "Continue"}
          {!busy && step < 3 && <ArrowRight />}
          {!busy && step === 3 && <Lock />}
        </button>
        <p className="mt-5 flex items-start gap-2 text-[0.78rem] text-fg-3">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Names, answers and the letter are encrypted in this browser. The server only sees ciphertext.
        </p>
      </form>
    </AuthLayout>
  );
}
