import "server-only";
import { ZodError } from "zod";
import { detectDrift } from "@/domain/drift";
import { computeQuestions } from "@/domain/questions";
import { computeReadiness } from "@/domain/readiness";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import { computeSwitch } from "@/domain/switch";
import type { NokMemory, NokState, ReleaseMemory, ScanResult, SnapshotMemory, StoredMemory, SwitchStatus } from "@/domain/types";
import { newId } from "@/domain/ids";
import type { ApiError, ScanResponse } from "@/lib/api-types";
import { chainMode, getEnv } from "./env";
import { MemoryServiceError } from "./memwal";
import * as store from "./store";
import { TatumError, TtlCache } from "./tatum/queue";
import { onchainLiveness, scanWallets, type OnchainLiveness } from "./tatum/scan";

// ─── Responses ──────────────────────────────────────────────────────────────

export function fail(error: string, status: number, code?: ApiError["code"], extra?: Record<string, unknown>): Response {
  return Response.json({ error, ...(code ? { code } : {}), ...extra } satisfies ApiError, { status });
}

/** Wrap a route so known upstream errors become honest, typed JSON. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) return fail("That memory doesn't match the expected shape.", 400, "invalid");
      if (err instanceof MemoryServiceError) {
        if (err.rateLimited) return fail("Walrus Memory is rate limiting us. Try again in a moment.", 429, "rate-limited", { retryAfterSeconds: err.retryAfterSeconds ?? 10 });
        return fail(err.message, 502, "upstream");
      }
      if (err instanceof TatumError) return fail(err.message, chainMode() === "unavailable" ? 503 : 502, "upstream");
      console.error("[nok] route error", err);
      return fail(err instanceof Error ? err.message : "Unexpected error.", 500);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ─── Seed guard on every plaintext string ───────────────────────────────────

/** Every string in a memory that is NOT inside an encrypted field. */
export function plaintextStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => plaintextStrings(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "enc") continue; // ciphertext
      out.push(k);
      plaintextStrings(v, out);
    }
  }
  return out;
}

export function secretIn(memory: unknown): boolean {
  return plaintextStrings(memory).some((s) => detectSecret(s).blocked);
}

export function secretRejected(): Response {
  return fail(SECRET_MESSAGE, 400, "secret-detected");
}

/** Short, non-sensitive annotation for snapshots. */
export function cleanCause(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.replace(/[^\p{L}\p{N}\s·…:.,'()+-]/gu, "").trim().slice(0, 120);
  if (!s || detectSecret(s).blocked) return undefined;
  return s;
}

// ─── Liveness + switch ──────────────────────────────────────────────────────

const g = globalThis as unknown as { __nokLive?: TtlCache<OnchainLiveness>; __nokScan?: TtlCache<ScanResult>; __nokRelease?: Promise<unknown> | null; __nokSnapLock?: Promise<unknown> };
const liveCache = (g.__nokLive ??= new TtlCache<OnchainLiveness>());
const scanCache = (g.__nokScan ??= new TtlCache<ScanResult>());

/** Sui addresses whose outgoing transactions count as signs of life. */
export function livenessAddresses(state: NokState): string[] {
  const set = new Set(getEnv().suiAddresses.map((a) => a.toLowerCase()));
  for (const w of state.wallets) if (w.chain === "sui") set.add(w.address.toLowerCase());
  return [...set].sort();
}

export async function liveness(state: NokState, opts: { fresh?: boolean } = {}): Promise<OnchainLiveness> {
  const addrs = livenessAddresses(state);
  const key = addrs.join(",");
  if (opts.fresh) liveCache.clear();
  return liveCache.getOrLoad(key, 60_000, () => onchainLiveness(addrs));
}

export async function switchFor(state: NokState, opts: { fresh?: boolean } = {}): Promise<{ sw: SwitchStatus; live: OnchainLiveness }> {
  const live = state.profile ? await liveness(state, opts) : { lastOnchain: null, available: false, source: "none" as const };
  const sw = computeSwitch({
    profile: state.profile,
    profileCreatedAt: state.profileCreatedAt,
    lastCheckin: state.lastCheckin,
    lastOnchain: live.lastOnchain,
    onchainAvailable: live.available,
    now: new Date().toISOString(),
  });
  return { sw, live };
}

// ─── Scan + analysis ────────────────────────────────────────────────────────

export async function scanFor(state: NokState, opts: { refresh?: boolean } = {}): Promise<ScanResult> {
  const refs = state.wallets.map((w) => ({ walletId: w.walletId, chain: w.chain, address: w.address }));
  const key = `${chainMode()}|${refs.map((r) => r.walletId).sort().join(",")}`;
  if (opts.refresh) scanCache.clear();
  return scanCache.getOrLoad(key, 60_000, () => scanWallets(refs));
}

export function analyze(scan: ScanResult, state: NokState) {
  const scannedWalletIds = new Set(scan.wallets.filter((w) => !w.error).map((w) => w.walletId));
  const drift = detectDrift(scan.assets, state, { scannedWalletIds });
  const driftedSet = new Set(drift.drifted.map((d) => d.assetKey));
  const readiness = computeReadiness(scan.assets, state, driftedSet);
  const questions = computeQuestions(scan.assets, state, drift);
  return { drift, readiness, questions };
}

/** Full scan response; writes a snapshot memory when the score moved by ≥ 1 point. */
function withSnapshotLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__nokSnapLock ?? Promise.resolve();
  const run = prev.then(fn, fn);
  g.__nokSnapLock = run.catch(() => undefined);
  return run;
}

export async function scanResponse(opts: { refresh?: boolean; cause?: string }): Promise<ScanResponse> {
  let state = await store.getState();
  const scan = await scanFor(state, opts);
  const { drift, readiness, questions } = analyze(scan, state);

  // Serialise the "did the score move?" decision so concurrent scans (two tabs,
  // a double-mounted effect) can't both write the same snapshot.
  const snapshot = await withSnapshotLock(async () => {
    const fresh = await store.getState();
    const last = fresh.snapshots[fresh.snapshots.length - 1];
    const moved = last ? Math.abs(last.score - readiness.score) >= 1 : readiness.assets > 0;
    if (!moved || !fresh.vault) return null;
    const memory: SnapshotMemory = {
      v: 1,
      id: newId(),
      kind: "snapshot",
      ts: new Date().toISOString(),
      score: readiness.score,
      coveredUsd: Math.round(readiness.coveredUsd * 100) / 100,
      totalUsd: Math.round(readiness.totalUsd * 100) / 100,
      assets: readiness.assets,
      covered: readiness.covered,
      ...(opts.cause ? { cause: opts.cause } : {}),
    };
    try {
      return await store.write(memory);
    } catch (err) {
      console.warn("[nok] snapshot write failed", err instanceof Error ? err.message : err);
      return null;
    }
  });
  if (snapshot) state = await store.getState();
  return { scan, drift, readiness, questions, snapshot, snapshots: state.snapshots };
}

// ─── Release audit ──────────────────────────────────────────────────────────

/**
 * Called when the switch reads "released". Writes exactly one release memory
 * per silence (none if one already exists after the last sign of life).
 * Returns null when the release can't be honestly verified yet.
 */
export async function ensureRelease(state: NokState, sw: SwitchStatus, live: OnchainLiveness): Promise<{ stored: StoredMemory | null; memory: ReleaseMemory } | null> {
  const existing = [...state.releases].reverse().find((r) => !sw.lastAlive || r.ts >= sw.lastAlive);
  if (existing) {
    const rec = await store.getById(existing.id);
    return { stored: rec, memory: existing };
  }
  const hasSui = livenessAddresses(state).length > 0;
  if (hasSui && !live.available) return null; // fail safe: never release on an unverified chain read
  const verifiedVia: ReleaseMemory["verifiedVia"] = !hasSui ? "checkins" : live.source === "fixtures" ? "fixtures" : "tatum";

  g.__nokRelease ??= (async () => {
    const mins = Math.round((sw.intervalSec + sw.graceSec) / 60);
    const memory: ReleaseMemory = {
      v: 1,
      id: newId(),
      kind: "release",
      ts: new Date().toISOString(),
      reason: `No check-in${hasSui ? " or outgoing transaction" : ""} for ${mins >= 2880 ? `${Math.round(mins / 1440)} days` : `${mins} minutes`} (interval plus grace).${verifiedVia === "fixtures" ? " Verified against fixture chain data, not live." : ""}`,
      lastCheckin: state.lastCheckin,
      lastOnchain: live.available ? live.lastOnchain : null,
      verifiedVia,
    };
    const stored = await store.write(memory);
    return { stored, memory };
  })().finally(() => {
    g.__nokRelease = null;
  });
  return (await g.__nokRelease) as { stored: StoredMemory; memory: ReleaseMemory };
}

export function isWriteAllowed(memory: NokMemory, state: NokState): string | null {
  if (memory.kind === "vault" && state.vault) return "This vault already has a passphrase. A second one would make your answers unreadable.";
  if (memory.kind !== "vault" && !state.vault) return "Set up the vault first.";
  if (memory.kind === "release") return "Releases are written by the switch, not by hand.";
  if (memory.kind === "snapshot") return "Snapshots are written by the scanner.";
  return null;
}
