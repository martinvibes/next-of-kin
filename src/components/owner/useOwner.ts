"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decryptFieldOrNull, encryptField } from "@/domain/crypto";
import { factKey } from "@/domain/fold";
import { newId } from "@/domain/ids";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import type { NokMemory, NokState, StoredMemory } from "@/domain/types";
import type { ScanResponse, StateResponse, StatusResponse, WriteResponse } from "@/lib/api-types";
import { api, ApiFailure } from "@/lib/client";

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

export function useOwner(key: CryptoKey, status: StatusResponse) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [dec, setDec] = useState<Decrypted | null>(null);
  const [receipts, setReceipts] = useState<Receipts>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGain, setLastGain] = useState<{ delta: number; at: number } | null>(null);
  const polling = useRef(new Set<string>());
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

  const runScan = useCallback(async (opts: { refresh?: boolean; cause?: string } = {}) => {
    setScanning(true);
    try {
      const r = await api<ScanResponse>("/api/scan", { owner: true, body: opts });
      if (!mounted.current) return r;
      setScan((prev) => {
        if (prev && r.readiness.score !== prev.readiness.score) setLastGain({ delta: r.readiness.score - prev.readiness.score, at: Date.now() });
        return r;
      });
      if (r.snapshot) track(r.snapshot);
      setError(null);
      return r;
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Scan failed.");
      return null;
    } finally {
      if (mounted.current) setScanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    [upsertReceipt],
  );

  /** Validate plaintext, encrypt, write, track, then refresh state + readiness. */
  const write = useCallback(
    async (memory: NokMemory, opts: { cause?: string; rescan?: boolean | "refresh" } = {}) => {
      const r = await api<WriteResponse>("/api/memories", { owner: true, body: { memory } });
      track(r.stored);
      await loadState();
      if (opts.rescan !== false) await runScan({ cause: opts.cause, refresh: opts.rescan === "refresh" });
      return r.stored;
    },
    [loadState, runScan, track],
  );

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
        setError(e instanceof ApiFailure ? e.message : "Couldn't load your vault.");
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
    lastGain,
    setError,
    loadState,
    runScan,
    write,
    enc,
    checkin,
    track,
    newMeta: () => ({ v: 1 as const, id: newId(), ts: new Date().toISOString() }),
  };
}

export type OwnerCtx = ReturnType<typeof useOwner>;
