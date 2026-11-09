"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { unlockVault } from "@/domain/crypto";
import type { StateResponse, StatusResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret, setOwnerSecret } from "@/lib/client";
import { Seal } from "@/components/Seal";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
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
      <Shell status={null}>
        <CenterNote>Opening your vault…</CenterNote>
      </Shell>
    );
  if (stage.k === "error")
    return (
      <Shell status={null}>
        <CenterNote>{stage.message}</CenterNote>
      </Shell>
    );
  if (stage.k === "no-setup")
    return (
      <Shell status={stage.status}>
        <section className="mx-auto max-w-xl px-4 pt-16 text-center sm:px-6">
          <Seal size={200} value={0} tone="ink" label="Empty seal">
            <span className="t-display text-4xl">0%</span>
          </Seal>
          <h1 className="t-display mt-10 text-[clamp(2.2rem,5vw,3.2rem)] text-balance">Nothing to hand over yet.</h1>
          <p className="mx-auto mt-4 max-w-md text-ink-2">
            Set a passphrase, name your heir and choose how often you&rsquo;ll check in. It takes about two minutes.
          </p>
          <Link href="/setup" className="btn btn-primary mt-8">
            Set up my vault
          </Link>
        </section>
      </Shell>
    );
  if (stage.k === "locked")
    return (
      <Shell status={stage.status}>
        <Unlock status={stage.status} onUnlocked={(key) => setStage({ k: "ready", status: stage.status, key })} />
      </Shell>
    );
  return (
    <>
      <ModeBanner status={stage.status} />
      <Dashboard cryptoKey={stage.key} status={stage.status} onLock={() => setStage({ k: "locked", status: stage.status })} />
    </>
  );
}

function Shell({ status, children }: { status: StatusResponse | null; children: React.ReactNode }) {
  return (
    <>
      <ModeBanner status={status} />
      <SiteHeader current="owner" />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-4 text-ink-2" role="status">
      {children}
    </div>
  );
}

function Unlock({ status, onUnlocked }: { status: StatusResponse; onUnlocked: (key: CryptoKey) => void }) {
  const [secret, setSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [pass, setPass] = useState("");
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

  return (
    <section className="mx-auto grid max-w-5xl items-center gap-14 px-4 pt-10 pb-20 sm:px-6 md:grid-cols-[0.9fr_1.1fr]">
      <div className="hidden justify-center md:flex">
        <Seal size={280} tone="ink" value={status.readiness?.score ?? 0} label="Your seal">
          <span className="t-display text-5xl t-num">{status.readiness ? `${status.readiness.score}%` : "—"}</span>
          <span className="mt-1 text-sm text-ink-2">heir readiness</span>
        </Seal>
      </div>
      <form onSubmit={submit} className="sheet p-7 sm:p-10" aria-labelledby="unlock-title">
        <h1 id="unlock-title" className="t-display text-[2.4rem] leading-tight">
          Open your vault
        </h1>
        <p className="mt-3 text-ink-2">Your answers are decrypted here, in this browser. The passphrase never leaves it.</p>
        {!hasSecret && (
          <div className="mt-8">
            <label htmlFor="owner-secret" className="label">
              Owner key
            </label>
            <input id="owner-secret" className="field" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} required />
            <p className="help">The OWNER_SECRET for this deployment. Asked once per session.</p>
          </div>
        )}
        <div className={hasSecret ? "mt-8" : "mt-5"}>
          <label htmlFor="vault-pass" className="label">
            Vault passphrase
          </label>
          <input
            id="vault-pass"
            className="field"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            autoFocus={hasSecret}
          />
        </div>
        {err && (
          <p className="mt-4 rounded-lg bg-claret-wash px-3 py-2 text-sm text-claret" role="alert">
            {err}
          </p>
        )}
        <div className="mt-8 flex items-center gap-4">
          <button className="btn btn-primary" disabled={busy || !pass || !secret}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
          {hasSecret && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setOwnerSecret(null);
                setHasSecret(false);
                setSecret("");
              }}
            >
              Use a different owner key
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
