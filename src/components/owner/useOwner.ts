"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decryptFieldOrNull, encryptField } from "@/domain/crypto";
import { summarize } from "@/domain/codec";
import { factKey } from "@/domain/fold";
import { newId } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import type { NokMemory, NokState, StoredMemory } from "@/domain/types";
import type { ScanResponse, StateResponse, StatusResponse, WriteResponse } from "@/lib/api-types";
import { api, ApiFailure, errorText } from "@/lib/client";
import { toast } from "@/components/ui/Toast";

export interface Decrypted {
  labels: Record<string, string>;
  /** factKey(target, field) → plaintext */
  facts: Record<string, string>;
  letter: string | null;
  ownerName: string | null;
  heirName: string | null;
  heirContact: string | null;
}

async function decryptAll(key: CryptoKey, state: NokState): Promise<Decrypted> {
  const labels: Record<string, string> = {};
  const facts: Record<string, string> = {};
  await Promise.all([
    ...state.wallets.map(async (w) => {
      labels[w.walletId] = (await decryptFieldOrNull(key, w.label)) ?? "";
    }),
    ...state.facts.map(async (f) => {
      const v = await decryptFieldOrNull(key, f.value);
      if (v !== null) facts[factKey(f.target, f.field)] = v;
    }),
  ]);
  const [letter, ownerName, heirName, heirContact] = await Promise.all([
    decryptFieldOrNull(key, state.letter?.value),
    decryptFieldOrNull(key, state.profile?.ownerName),
    decryptFieldOrNull(key, state.profile?.heirName),
    decryptFieldOrNull(key, state.profile?.heirContact),
  ]);
  return { labels, facts, letter, ownerName, heirName, heirContact };
}

export type Receipts = StoredMemory[];

export interface WriteResult {
  stored: StoredMemory;
  /** readiness before and after the write's rescan (null when unknown or not rescanned) */
  before: number | null;
  after: number | null;
  scan: ScanResponse | null;
}

/** "Readiness 38% → 52%." when it moved, "" otherwise. */
export function readinessNote(before: number | null, after: number | null): string {
  if (before === null || after === null || before === after) return "";
  return `Readiness ${before}% → ${after}%.`;
}

export function useOwner(key: CryptoKey, status: StatusResponse) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [dec, setDec] = useState<Decrypted | null>(null);
  const [receipts, setReceipts] = useState<Receipts>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(new Set<string>());
  const score = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadState = useCallback(async () => {
    const s = await api<StateResponse>("/api/state", { owner: true });
    if (!mounted.current) return s;
    setState(s);
    setDec(await decryptAll(key, s.state));
    return s;
  }, [key]);

  /** One scan; throws on failure. */
  const scanNow = useCallback(async (opts: { refresh?: boolean; cause?: string } = {}) => {
    setScanning(true);
    try {
      const r = await api<ScanResponse>("/api/scan", { owner: true, body: opts });
      score.current = r.readiness.score;
      if (!mounted.current) return r;
      setScan(r);
      if (r.snapshot) track(r.snapshot);
      return r;
    } finally {
      if (mounted.current) setScanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Background scan: a failure shows in the dashboard's error bar. */
  const runScan = useCallback(
    async (opts: { refresh?: boolean; cause?: string } = {}) => {
      try {
        const r = await scanNow(opts);
        if (mounted.current) setError(null);
        return r;
      } catch (e) {
        if (mounted.current) setError(errorText(e, "Couldn't read your wallets just now. Try again in a minute."));
        return null;
      }
    },
    [scanNow],
  );

  /** The Rescan button: fresh chain reads, with a toast either way. */
  const rescan = useCallback(
    async function again(): Promise<void> {
      const before = score.current;
      try {
        const r = await scanNow({ refresh: true });
        if (mounted.current) setError(null);
        const n = r.scan.wallets.length;
        const unread = r.scan.wallets.filter((w) => w.error).length;
        const source = status.chain.mode === "live" ? "through Tatum" : "from fixture data, not live";
        if (n === 0) toast.info("Nothing to scan yet", "Add a wallet's public address and it will be read here.");
        else if (unread > 0)
          toast.info(`Read ${n - unread} of ${n} wallets`, `${unread} couldn't be read just now. Their drift checks wait for the next scan. ${readinessNote(before, r.readiness.score)}`);
        else toast.success("Balances refreshed", `Read ${n} wallet${n === 1 ? "" : "s"} ${source}. ${readinessNote(before, r.readiness.score)}`);
      } catch (e) {
        toast.error("Couldn't refresh balances", errorText(e, "The scan didn't finish. Try again in a minute."), { label: "Try again", onClick: () => void again() });
      }
    },
    [scanNow, status.chain.mode],
  );

  const upsertReceipt = useCallback((stored: StoredMemory) => {
    setReceipts((rs) => {
      const i = rs.findIndex((r) => r.memory.id === stored.memory.id);
      if (i < 0) return [stored, ...rs].slice(0, 6);
      const next = rs.slice();
      next[i] = stored;
      return next;
    });
  }, []);

  const track = useCallback(
    (stored: StoredMemory) => {
      upsertReceipt(stored);
      const id = stored.memory.id;
      if (stored.status !== "pending" || polling.current.has(id)) return;
      polling.current.add(id);
      let tries = 0;
      const tick = async () => {
        tries++;
        try {
          const r = await api<WriteResponse>(`/api/memories/status?id=${encodeURIComponent(id)}`, { owner: true });
          if (!mounted.current) return;
          upsertReceipt(r.stored);
          if (r.stored.status !== "pending") {
            polling.current.delete(id);
            if (r.stored.status === "failed")
              toast.error(
                status.memory.mode === "mainnet" ? "A memory didn't reach Walrus" : "A memory didn't save",
                `${summarize(r.stored.memory)}. It doesn't count until it's saved again, so repeat that step.`,
              );
            return;
          }
        } catch {
          /* keep polling a little longer */
        }
        if (tries < 90 && mounted.current) setTimeout(tick, tries < 10 ? 2000 : 4000);
        else polling.current.delete(id);
      };
      setTimeout(tick, 1500);
    },
    [upsertReceipt, status.memory.mode],
  );

  /** Validate plaintext, encrypt, write, track, then refresh state + readiness. */
  const write = useCallback(
    async (memory: NokMemory, opts: { cause?: string; rescan?: boolean | "refresh" } = {}): Promise<WriteResult> => {
      const before = score.current;
      const r = await api<WriteResponse>("/api/memories", { owner: true, body: { memory } });
      track(r.stored);
      await loadState();
      // The write already landed; a failed rescan shows in the error bar, not as a failed save.
      const s = opts.rescan !== false ? await runScan({ cause: opts.cause, refresh: opts.rescan === "refresh" }) : null;
      return { stored: r.stored, before, after: s ? s.readiness.score : null, scan: s };
    },
    [loadState, runScan, track],
  );

  /** Where a write went, said honestly for this deployment. */
  const savedTo =
    status.memory.mode === "mainnet" ? "Encrypted in this browser and sent to Walrus Memory." : "Encrypted in this browser and saved to mock memory, not Walrus.";

  /** The error bar's "Try again": reload the vault, then rescan. */
  const reload = useCallback(async () => {
    setError(null);
    try {
      await loadState();
    } catch (e) {
      setError(errorText(e, "Couldn't load your vault."));
      return;
    }
    await runScan({ refresh: true });
  }, [loadState, runScan]);

  const enc = useCallback(
    async (plaintext: string) => {
      const check = detectSecret(plaintext);
      if (check.blocked) throw new ApiFailure(SECRET_MESSAGE, 400, "secret-detected");
      return encryptField(key, plaintext.trim());
    },
    [key],
  );

  const checkin = useCallback(async () => {
    const r = await api<WriteResponse & { switch: StateResponse["switch"] }>("/api/checkin", { owner: true, body: {} });
    track(r.stored);
    await loadState();
    return r;
  }, [loadState, track]);

  useEffect(() => {
    (async () => {
      try {
        await loadState();
        await runScan({ refresh: true });
      } catch (e) {
        setError(errorText(e, "Couldn't load your vault."));
      }
    })();
  }, [loadState, runScan]);

  return {
    status,
    state,
    scan,
    dec,
    receipts,
    scanning,
    error,
    setError,
    loadState,
    runScan,
    rescan,
    reload,
    savedTo,
    write,
    enc,
    checkin,
    track,
    newMeta: () => ({ v: 1 as const, id: newId(), ts: new Date().toISOString() }),
  };
}

export type OwnerCtx = ReturnType<typeof useOwner>;
