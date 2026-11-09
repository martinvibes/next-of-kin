"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { unlockVault } from "@/domain/crypto";
import { relativeTime } from "@/domain/format";
import type { StateResponse, StatusResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret, setOwnerSecret } from "@/lib/client";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { LogoMark } from "@/components/ui/Logo";
import { ModeBanner } from "@/components/ModeBanner";
import { Dashboard } from "./Dashboard";

type Stage = { k: "loading" } | { k: "error"; message: string } | { k: "no-setup"; status: StatusResponse } | { k: "locked"; status: StatusResponse } | { k: "ready"; status: StatusResponse; key: CryptoKey };

export function OwnerApp() {
  const [stage, setStage] = useState<Stage>({ k: "loading" });

  useEffect(() => {
    api<StatusResponse>("/api/status")
      .then((status) => setStage(status.setup ? { k: "locked", status } : { k: "no-setup", status }))
      .catch((e) => setStage({ k: "error", message: e instanceof ApiFailure ? e.message : "Couldn't load." }));
  }, []);

  if (stage.k === "loading")
    return (
      <AuthLayout status={null}>
        <div className="card p-8" role="status">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="skeleton mt-6 h-6 w-48" />
          <div className="skeleton mt-3 h-4 w-64" />
          <div className="skeleton mt-8 h-11" />
          <div className="skeleton mt-4 h-11" />
        </div>
      </AuthLayout>
    );
  if (stage.k === "error")
    return (
      <AuthLayout status={null}>
        <div className="card p-8 text-center" role="alert">
          <p className="font-medium">Couldn&rsquo;t open the vault</p>
          <p className="mt-2 text-[0.875rem] text-fg-2">{stage.message}</p>
          <button type="button" className="btn btn-secondary mt-6" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </AuthLayout>
    );
  if (stage.k === "no-setup")
    return (
      <AuthLayout status={stage.status}>
        <div className="card glow-mint p-8 animate-rise">
          <LogoMark size={40} />
          <h1 className="mt-6 text-[1.6rem] leading-tight font-semibold tracking-[-0.03em]">Nothing to hand over yet</h1>
          <p className="mt-2 text-[0.9375rem] text-fg-2">Set a passphrase, name your heir and choose how often you&rsquo;ll check in. It takes about two minutes.</p>
          <Link href="/setup" className="btn btn-primary btn-lg mt-7 w-full">
            Set up my vault <ArrowRight />
          </Link>
        </div>
      </AuthLayout>
    );
  if (stage.k === "locked") return <Unlock status={stage.status} onUnlocked={(key) => setStage({ k: "ready", status: stage.status, key })} />;
  return (
    <>
      <ModeBanner status={stage.status} />
      <Dashboard cryptoKey={stage.key} status={stage.status} onLock={() => setStage({ k: "locked", status: stage.status })} />
    </>
  );
}

function Unlock({ status, onUnlocked }: { status: StatusResponse; onUnlocked: (key: CryptoKey) => void }) {
  const [secret, setSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = getOwnerSecret();
    if (s) {
      setSecret(s);
      setHasSecret(true);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const s = await api<StateResponse>("/api/state", { secret: secret.trim() });
      if (!s.state.vault) throw new Error("This vault has no passphrase yet. Finish setup first.");
      const key = await unlockVault(s.state.vault, pass);
      if (!key) {
        setErr("That passphrase doesn't open this vault. Check for typos and capital letters.");
        return;
      }
      setOwnerSecret(secret.trim());
      onUnlocked(key);
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) {
        setHasSecret(false);
        setOwnerSecret(null);
        setErr("That owner key isn't right. It's the OWNER_SECRET set for this deployment.");
      } else setErr(e instanceof Error ? e.message : "Couldn't unlock.");
    } finally {
      setBusy(false);
    }
  }

  const facts: string[] = [];
  if (status.readiness) facts.push(`Readiness ${status.readiness.score}%`);
  facts.push(`${status.memories} ${status.memories === 1 ? "memory" : "memories"}`);
  if (status.switch.lastAlive) facts.push(`last seen ${relativeTime(status.switch.lastAlive, new Date().toISOString())}`);

  return (
    <AuthLayout status={status}>
      <form onSubmit={submit} className="card p-7 animate-rise sm:p-8" aria-labelledby="unlock-title">
        <span className="grid size-11 place-items-center rounded-xl border border-line-2 bg-panel-2 text-mint">
          <Lock className="size-5" />
        </span>
        <h1 id="unlock-title" className="mt-6 text-[1.6rem] leading-tight font-semibold tracking-[-0.03em]">
          Open your vault
        </h1>
        <p className="mt-2 text-[0.875rem] text-fg-2">Your answers are decrypted here, in this browser. The passphrase never leaves it.</p>

        {!hasSecret && (
          <div className="mt-7">
            <label htmlFor="owner-secret" className="label">
              Owner key
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
              <input id="owner-secret" className="input !pl-9" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} required />
            </div>
            <p className="help">The OWNER_SECRET for this deployment. Asked once per session.</p>
          </div>
        )}
        <div className={hasSecret ? "mt-7" : "mt-4"}>
          <label htmlFor="vault-pass" className="label">
            Vault passphrase
          </label>
          <div className="relative">
            <input
              id="vault-pass"
              className="input !pr-11"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              autoFocus={hasSecret}
            />
            <button type="button" className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:text-fg" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passphrase" : "Show passphrase"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {err && (
          <p className="mt-4 rounded-lg border border-rose/20 bg-rose-wash px-3 py-2 text-[0.8125rem] text-rose" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn-primary btn-lg mt-6 w-full" disabled={busy || !pass || !secret}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        {hasSecret && (
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2 w-full"
            onClick={() => {
              setOwnerSecret(null);
              setHasSecret(false);
              setSecret("");
            }}
          >
            Use a different owner key
          </button>
        )}
      </form>
      <p className="mt-5 flex items-center justify-center gap-2 text-center text-[0.75rem] text-fg-3">
        <ShieldCheck className="size-3.5 text-mint" aria-hidden="true" />
        {facts.join(" · ")}
      </p>
    </AuthLayout>
  );
}
