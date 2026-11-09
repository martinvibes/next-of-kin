"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, HeartPulse, KeyRound, Lock, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { createVault, encryptField, passphraseStrength } from "@/domain/crypto";
import { newId } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import { graceFor, INTERVAL_PRESETS, type ProfileMemory, type VaultMemory } from "@/domain/types";
import { formatInterval } from "@/domain/format";
import type { StateResponse, StatusResponse, WriteResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret, setOwnerSecret } from "@/lib/client";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { LogoMark } from "@/components/ui/Logo";
import { ModeBanner } from "@/components/ModeBanner";
import { Dashboard } from "@/components/owner/Dashboard";

type Step = 0 | 1 | 2 | 3;
const STEPS: { title: string; sub: string; icon: LucideIcon }[] = [
  { title: "Owner key", sub: "Prove this deployment is yours", icon: KeyRound },
  { title: "Names", sub: "Who the letter is for", icon: Users },
  { title: "Passphrase", sub: "The key your heir will use", icon: Lock },
  { title: "Check-ins", sub: "How long before it opens", icon: HeartPulse },
];

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
        <div className="card p-8 text-center animate-rise">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-mint-wash text-mint">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="mt-5 text-[1.5rem] font-semibold tracking-[-0.03em]">This vault is already sealed</h1>
          <p className="mt-2 text-[0.875rem] text-fg-2">One vault per deployment. Open it with your passphrase to keep going.</p>
          <a href="/owner" className="btn btn-primary btn-lg mt-7 w-full">
            Open my vault
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
  const H = "text-[1.45rem] leading-tight font-semibold tracking-[-0.03em] outline-none sm:text-[1.7rem]";

  return (
    <AuthLayout status={status} wide>
      <div className="card grid overflow-hidden animate-rise md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden flex-col border-r border-line bg-bg-2/70 p-6 md:flex" aria-label="Setup steps">
          <LogoMark size={32} />
          <p className="mt-5 font-semibold">Set up your vault</p>
          <p className="text-[0.8125rem] text-fg-3">About two minutes</p>
          <ol className="relative mt-8 space-y-5">
            <span className="absolute top-4 bottom-4 left-[15px] w-px bg-line-2" aria-hidden="true" />
            {STEPS.map((s, i) => {
              const state = i < step ? "done" : i === step ? "now" : "next";
              return (
                <li key={s.title} className="relative flex items-start gap-3" aria-current={state === "now" ? "step" : undefined}>
                  <span
                    className={`relative grid size-8 shrink-0 place-items-center rounded-full border transition-colors ${
                      state === "done" ? "border-mint bg-mint text-mint-ink" : state === "now" ? "border-mint/60 bg-panel text-mint shadow-[0_0_0_4px_rgba(92,233,198,0.1)]" : "border-line-2 bg-panel text-fg-3"
                    }`}
                  >
                    {state === "done" ? <Check className="size-4" /> : <s.icon className="size-3.5" />}
                  </span>
                  <span className="pt-0.5">
                    <span className={`block text-[0.875rem] font-medium ${state === "next" ? "text-fg-3" : "text-fg"}`}>{s.title}</span>
                    <span className="block text-[0.75rem] text-fg-3">{s.sub}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-auto flex gap-2 pt-10 text-[0.75rem] text-fg-3">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-mint" aria-hidden="true" />
            Names, answers and the letter are encrypted in this browser. The server only sees ciphertext.
          </p>
        </aside>

        <form onSubmit={next} className="flex min-h-[460px] flex-col p-6 sm:p-10" aria-labelledby="step-title" noValidate>
          <div className="mb-6 md:hidden">
            <p className="text-[0.75rem] text-fg-3">
              Step {step + 1} of 4 · {STEPS[step].title}
            </p>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-mint" : "bg-white/[0.08]"}`} />
              ))}
            </div>
          </div>

          {step === 0 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className={H}>
                Prove this deployment is yours
              </h1>
              <p className="mt-2 text-[0.9375rem] text-fg-2">Paste the OWNER_SECRET you set on the server. It&rsquo;s kept for this browser session only.</p>
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
              <p className="mt-2 text-[0.9375rem] text-fg-2">Names are encrypted in this browser before they&rsquo;re stored.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
              </div>
              <label htmlFor="heir-contact" className="label mt-4">
                How should they be reached?
              </label>
              <input id="heir-contact" className="input" value={heirContact} onChange={(e) => setHeirContact(e.target.value)} placeholder="ada@example.com, or through our lawyer at Reyes & Hart" maxLength={200} />
              <p className="help">Shown to {heir} inside the released letter, so they know who to call.</p>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="step-title" ref={headingRef} tabIndex={-1} className={H}>
                Choose the passphrase {heir} will use
              </h1>
              <p className="mt-2 text-[0.9375rem] text-fg-2">It encrypts everything you write here, and it&rsquo;s the only way to open the letter. Make one up. Never use a wallet&rsquo;s recovery phrase.</p>
              <label htmlFor="pass" className="label mt-8">
                Passphrase
              </label>
              <input id="pass" className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus aria-describedby="pass-strength" />
              <div className="mt-2 flex items-center gap-3" id="pass-strength">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${pass && strength.score > i ? (strength.score === 3 ? "bg-mint" : strength.score === 2 ? "bg-amber" : "bg-rose") : "bg-white/[0.08]"}`} />
                  ))}
                </div>
                <span className="w-44 text-right text-[0.72rem] text-fg-3">{pass ? (passSecret ? "Looks like a recovery phrase" : strength.label) : "Four ordinary words is plenty"}</span>
              </div>
              <label htmlFor="pass2" className="label mt-4">
                Once more
              </label>
              <input id="pass2" className="input" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} aria-invalid={!!pass2 && pass !== pass2} />
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber/20 bg-amber-wash px-4 py-3 text-[0.875rem]">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--mint)]" checked={wrote} onChange={(e) => setWrote(e.target.checked)} />
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
              <p className="mt-2 text-[0.9375rem] text-fg-2">If you don&rsquo;t check in, and none of your Sui wallets send a transaction, the letter opens after this long plus a 25% grace period.</p>
              <fieldset className="mt-7 grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Check-in interval</legend>
                {INTERVAL_PRESETS.map((p) => {
                  const on = interval === p.sec;
                  return (
                    <label key={p.sec} className={`relative cursor-pointer rounded-xl border px-4 py-3.5 transition-colors ${on ? "border-mint/60 bg-mint-wash" : "border-line-2 bg-bg-2 hover:border-white/20"}`}>
                      <input type="radio" name="interval" className="sr-only" checked={on} onChange={() => setIntervalSec(p.sec)} />
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.label}</span>
                        {p.demo ? <span className="pill pill-amber">demo</span> : on && <Check className="size-4 text-mint" />}
                      </span>
                      <span className="mt-0.5 block text-[0.78rem] text-fg-3">{p.demo ? "Try the whole switch in minutes" : `then ${formatInterval(graceFor(p.sec))} grace`}</span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}

          {err && (
            <p className="mt-5 rounded-lg border border-rose/20 bg-rose-wash px-3 py-2 text-[0.8125rem] text-rose" role="alert">
              {err}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-10">
            {step > minStep ? (
              <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
                <ArrowLeft /> Back
              </button>
            ) : (
              <span />
            )}
            <button className="btn btn-primary btn-lg" disabled={!canContinue}>
              {busy ? (step === 3 ? "Sealing the vault…" : "Checking…") : step === 3 ? "Seal the vault" : "Continue"}
              {!busy && step < 3 && <ArrowRight />}
              {!busy && step === 3 && <Lock />}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
