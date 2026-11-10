import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { decodeMemoryDetailed, encodeMemory, MEMORY_PREFIX } from "@/domain/codec";
import { foldMemories } from "@/domain/fold";
import { shortAddress } from "@/domain/ids";
import type { NokMemory, NokState, StoredMemory } from "@/domain/types";
import { getEnv, memoryMode, type MemoryMode } from "./env";
import { jobStatus, listAll, MemoryServiceError, recall, RECALL_LIMIT_MAX, rememberAsync } from "./memwal";

/**
 * "Memory is the database."
 *
 * The app keeps no database. Every memory lives on Walrus Memory; this store
 * is a cache in front of it: an in-process Map plus a JSON file in /tmp
 * (per-instance on Vercel). A cold instance rebuilds itself from Walrus.
 * New writes enter the cache immediately as `pending` and become `stored`
 * with a blob id once the relayer finishes.
 */

export interface RebuildReport {
  /** unique memories decoded from recall results */
  restored: number;
  /** memories the relayer inventory (listMemories) reports for our namespace */
  listed: number;
  /** recalled texts that failed to decode (malformed / tampered / foreign) */
  dropped: number;
  queries: string[];
  /** restored + dropped >= listed */
  complete: boolean;
  /** human sentence for the proof page */
  message: string;
  startedAt: string;
  finishedAt: string;
  mode: MemoryMode;
  /** set when listMemories itself failed (listed is then 0 and unknown) */
  inventoryError?: string;
}

export interface JobPoll {
  jobId: string;
  memoryId: string | null;
  status: StoredMemory["status"];
  /** raw relayer status: pending | running | uploaded | done | failed | not_found */
  relayerStatus: string;
  blobId?: string;
  error?: string;
}

interface StoreState {
  byId: Map<string, StoredMemory>;
  loaded: boolean;
  loadPromise: Promise<void> | null;
  rebuildPromise: Promise<RebuildReport> | null;
  lastRebuild: RebuildReport | null;
  /** memories dropped by the decoder during the last rebuild */
  dropped: number;
  persistError: string | null;
  fingerprint: string;
  /** last time this instance compared its cache with the relayer inventory */
  lastSyncAt: number;
}

const CACHE_VERSION = 1;
const g = globalThis as typeof globalThis & { __nokStore?: StoreState };

function fingerprint(): string {
  const env = getEnv();
  const account = env.memwal ? createHash("sha256").update(env.memwal.accountId).digest("hex").slice(0, 16) : "mock";
  return `${memoryMode(env)}|${env.namespace}|${account}`;
}

/** The store resets itself if the Walrus account/namespace/mode changes (e.g. creds added). */
function state(): StoreState {
  const fp = fingerprint();
  if (!g.__nokStore || g.__nokStore.fingerprint !== fp) {
    g.__nokStore = {
      byId: new Map(),
      loaded: false,
      loadPromise: null,
      rebuildPromise: null,
      lastRebuild: null,
      dropped: 0,
      persistError: null,
      fingerprint: fp,
      lastSyncAt: Date.now(),
    };
  }
  return g.__nokStore;
}

export function cachePath(): string {
  if (process.env.NOK_CACHE_PATH) return process.env.NOK_CACHE_PATH;
  const dir = existsSync("/tmp") ? "/tmp" : tmpdir();
  return path.join(dir, "nok-cache.json");
}

// ─── Persistence ────────────────────────────────────────────────────────────

interface CacheFile {
  version: number;
  fingerprint: string;
  savedAt: string;
  lastRebuild: RebuildReport | null;
  memories: StoredMemory[];
}

async function persist(s: StoreState): Promise<void> {
  const file: CacheFile = {
    version: CACHE_VERSION,
    fingerprint: s.fingerprint,
    savedAt: new Date().toISOString(),
    lastRebuild: s.lastRebuild,
    memories: [...s.byId.values()],
  };
  const target = cachePath();
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(tmp, JSON.stringify(file), "utf8");
    await rename(tmp, target);
    s.persistError = null;
  } catch (err) {
    s.persistError = err instanceof Error ? err.message : String(err);
  }
}

/** Read the cache file; re-validates every memory through the codec so a corrupt file can't inject state. */
async function loadFile(s: StoreState): Promise<boolean> {
  try {
    const raw = JSON.parse(await readFile(cachePath(), "utf8")) as Partial<CacheFile>;
    if (raw.version !== CACHE_VERSION || raw.fingerprint !== s.fingerprint || !Array.isArray(raw.memories)) return false;
    for (const entry of raw.memories) {
      if (!entry || typeof entry.text !== "string") continue;
      const decoded = decodeMemoryDetailed(entry.text);
      if (!decoded.ok) continue;
      const status = entry.status === "stored" || entry.status === "pending" || entry.status === "failed" ? entry.status : "pending";
      s.byId.set(decoded.memory.id, {
        memory: decoded.memory,
        text: entry.text,
        status,
        ...(entry.jobId ? { jobId: entry.jobId } : {}),
        ...(entry.blobId ? { blobId: entry.blobId } : {}),
        ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
        ...(entry.error ? { error: entry.error } : {}),
      });
    }
    s.lastRebuild = raw.lastRebuild ?? null;
    return s.byId.size > 0;
  } catch {
    return false;
  }
}

/** Load once per instance: cache file first, otherwise a full rebuild from Walrus (single-flight). */
async function ensureLoaded(): Promise<StoreState> {
  const s = state();
  if (s.loaded) {
    await maybeResync(s);
    return s;
  }
  s.loadPromise ??= (async () => {
    const fromFile = await loadFile(s);
    if (!fromFile) {
      try {
        await rebuildInto(s);
      } catch (err) {
        // An unreachable relayer must not brick the app; serve what we have and retry on next call.
        console.warn("[nok] cold-start rebuild from Walrus failed:", err instanceof Error ? err.message : err);
        s.loadPromise = null;
        return;
      }
    }
    s.loaded = true;
  })();
  await s.loadPromise;
  return s;
}

/**
 * Each serverless instance loads once, so another instance's writes would stay invisible.
 * Every RESYNC_MS, compare the relayer inventory with this cache and pull in what's missing.
 */
const RESYNC_MS = 30_000;

async function maybeResync(s: StoreState): Promise<void> {
  if (memoryMode() !== "mainnet" || s.rebuildPromise || Date.now() - s.lastSyncAt < RESYNC_MS) return;
  s.lastSyncAt = Date.now();
  try {
    const listed = (await listAll()).length;
    const stored = [...s.byId.values()].filter((m) => m.status === "stored").length;
    if (listed > stored) await rebuildInto(s);
  } catch (err) {
    console.warn("[nok] resync with Walrus skipped:", err instanceof Error ? err.message : err);
  }
}

function sortByTs(list: StoredMemory[]): StoredMemory[] {
  return list.sort((a, b) => a.memory.ts.localeCompare(b.memory.ts) || a.memory.id.localeCompare(b.memory.id));
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Every cached memory (stored, pending and failed), oldest first. */
export async function getAll(): Promise<StoredMemory[]> {
  const s = await ensureLoaded();
  return sortByTs([...s.byId.values()]);
}

/** Folded state. Failed writes never reached Walrus, so they are excluded; pending writes are included optimistically. */
export async function getState(): Promise<NokState> {
  const all = await getAll();
  return foldMemories(all.filter((m) => m.status !== "failed").map((m) => m.memory));
}

export async function getById(memoryId: string): Promise<StoredMemory | null> {
  const s = await ensureLoaded();
  return s.byId.get(memoryId) ?? null;
}

export function storeInfo(): {
  loaded: boolean;
  count: number;
  pending: number;
  failed: number;
  lastRebuild: RebuildReport | null;
  cachePath: string;
  persistError: string | null;
  mode: MemoryMode;
} {
  const s = state();
  const values = [...s.byId.values()];
  return {
    loaded: s.loaded,
    count: values.length,
    pending: values.filter((v) => v.status === "pending").length,
    failed: values.filter((v) => v.status === "failed").length,
    lastRebuild: s.lastRebuild,
    cachePath: cachePath(),
    persistError: s.persistError,
    mode: memoryMode(),
  };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Write one memory to Walrus Memory. Returns immediately with status
 * `pending` and the relayer job id — the client polls pollJob(). Idempotent:
 * the memory id is the idempotency key, and re-writing a known id returns the
 * existing record. Throws on schema errors (ZodError) or relayer failure
 * (MemoryServiceError); nothing is cached on failure, so the caller can retry.
 */
export async function write(memory: NokMemory): Promise<StoredMemory> {
  const s = await ensureLoaded();
  const existing = s.byId.get(memory.id);
  if (existing && existing.status !== "failed") return existing;

  const text = encodeMemory(memory);
  // Cache exactly what Walrus will hold (the decoded codec output), so a later
  // rebuild reproduces identical state.
  const decoded = decodeMemoryDetailed(text);
  if (!decoded.ok) throw new Error(`codec round-trip failed: ${decoded.reason}`);
  const accepted = await rememberAsync(text, memory.id);
  const record: StoredMemory = { memory: decoded.memory, text, status: "pending", jobId: accepted.jobId };
  s.byId.set(memory.id, record);

  // The mock (and occasionally a fast relayer) finishes immediately.
  if (accepted.status === "done") await refreshOne(record).catch(() => undefined);
  await persist(s);
  return record;
}

/**
 * Serverless instances don't share memory, and the relayer lists a write only once it's
 * indexed (~15s). The owner's browser sends back what it wrote this session so whichever
 * instance answers next folds the same state. Only the codec text is trusted: it must decode
 * to the claimed id, and records this instance already knows are left alone. Adopted records
 * stay `pending` with their relayer job id, so they still poll through to `stored`.
 */
export async function adopt(records: unknown, isSafe: (m: NokMemory) => boolean): Promise<number> {
  if (!Array.isArray(records)) return 0;
  const s = await ensureLoaded();
  let added = 0;
  for (const r of records.slice(0, ADOPT_MAX)) {
    if (!r || typeof r !== "object") continue;
    const { text, jobId, memory } = r as Partial<StoredMemory>;
    if (typeof text !== "string" || text.length > 64_000 || typeof jobId !== "string" || !memory?.id) continue;
    if (s.byId.has(memory.id)) continue;
    const decoded = decodeMemoryDetailed(text);
    if (!decoded.ok || decoded.memory.id !== memory.id || !isSafe(decoded.memory)) continue;
    s.byId.set(memory.id, { memory: decoded.memory, text, status: "pending", jobId });
    added++;
  }
  if (added) await persist(s);
  return added;
}
const ADOPT_MAX = 40;

async function refreshOne(record: StoredMemory): Promise<string> {
  if (!record.jobId) return "unknown";
  const st = await jobStatus(record.jobId);
  if (st.status === "done") {
    record.status = "stored";
    if (st.blob_id) record.blobId = st.blob_id;
    record.createdAt ??= new Date().toISOString();
    delete record.error;
  } else if (st.status === "failed") {
    record.status = "failed";
    record.error = st.error ?? "Walrus Memory reported the write failed";
  } else if (st.blob_id) {
    record.blobId = st.blob_id; // "uploaded": blob exists, indexing not finished
  }
  return st.status;
}

/** Poll the relayer for pending writes (bounded per call). */
export async function refreshPending(max = 10): Promise<{ checked: number; stored: number; failed: number; stillPending: number }> {
  const s = await ensureLoaded();
  const pending = [...s.byId.values()].filter((m) => m.status === "pending" && m.jobId).slice(0, max);
  let stored = 0;
  let failed = 0;
  for (const rec of pending) {
    try {
      await refreshOne(rec);
    } catch (err) {
      if (err instanceof MemoryServiceError && err.rateLimited) break;
    }
    if (rec.status === "stored") stored++;
    if (rec.status === "failed") failed++;
  }
  if (pending.length) await persist(s);
  const stillPending = [...s.byId.values()].filter((m) => m.status === "pending").length;
  return { checked: pending.length, stored, failed, stillPending };
}

/** Status of one write job (for the client's pending → stored indicator). */
export async function pollJob(jobId: string): Promise<JobPoll> {
  const s = await ensureLoaded();
  const rec = [...s.byId.values()].find((m) => m.jobId === jobId) ?? null;
  if (rec) {
    if (rec.status !== "pending") {
      return { jobId, memoryId: rec.memory.id, status: rec.status, relayerStatus: rec.status === "stored" ? "done" : "failed", ...(rec.blobId ? { blobId: rec.blobId } : {}), ...(rec.error ? { error: rec.error } : {}) };
    }
    const relayerStatus = await refreshOne(rec);
    await persist(s);
    return { jobId, memoryId: rec.memory.id, status: rec.status, relayerStatus, ...(rec.blobId ? { blobId: rec.blobId } : {}), ...(rec.error ? { error: rec.error } : {}) };
  }
  // Unknown to this instance (e.g. written by another serverless instance): ask the relayer directly.
  const st = await jobStatus(jobId);
  return {
    jobId,
    memoryId: null,
    status: st.status === "done" ? "stored" : st.status === "failed" ? "failed" : "pending",
    relayerStatus: st.status,
    ...(st.blob_id ? { blobId: st.blob_id } : {}),
    ...(st.error ? { error: st.error } : {}),
  };
}

// ─── Rebuild from Walrus ────────────────────────────────────────────────────

export const BASE_QUERIES = [
  `${MEMORY_PREFIX} wallet`,
  `${MEMORY_PREFIX} fact`,
  `${MEMORY_PREFIX} snapshot`,
  `${MEMORY_PREFIX} checkin`,
  `${MEMORY_PREFIX} profile vault letter confirm release`,
];

const EXTRA_KIND_QUERIES = [
  `${MEMORY_PREFIX} · vault · encrypted passphrase check created`,
  `${MEMORY_PREFIX} · profile · owner check-in every`,
  `${MEMORY_PREFIX} · letter · encrypted message to the heir`,
  `${MEMORY_PREFIX} · release · heir recovery guide released`,
  `${MEMORY_PREFIX} · confirm · still accurate owner moved it spent or sold`,
  `${MEMORY_PREFIX} · checkin · owner proof of life`,
  `${MEMORY_PREFIX} · snapshot · heir readiness`,
];

interface Collected {
  byBlob: Map<string, { text: string; createdAt?: string }>;
  queries: string[];
}

async function collect(c: Collected, query: string, sort?: "recent"): Promise<number> {
  const before = c.byBlob.size;
  const results = await recall(query, RECALL_LIMIT_MAX, sort ? { sort } : {});
  c.queries.push(sort ? `${query} (recent)` : query);
  for (const r of results) {
    if (!r.blob_id || c.byBlob.has(r.blob_id)) continue;
    c.byBlob.set(r.blob_id, { text: r.text, ...(r.created_at ? { createdAt: r.created_at } : {}) });
  }
  return c.byBlob.size - before;
}

function decodeAll(c: Collected): { memories: Map<string, StoredMemory>; dropped: number } {
  const memories = new Map<string, StoredMemory>();
  let dropped = 0;
  for (const [blobId, { text, createdAt }] of c.byBlob) {
    const d = decodeMemoryDetailed(text);
    if (!d.ok) {
      dropped++;
      continue;
    }
    const prev = memories.get(d.memory.id);
    // Same memory id in two blobs (a retried write): keep the earliest blob.
    if (prev && (prev.createdAt ?? "") <= (createdAt ?? "")) continue;
    memories.set(d.memory.id, { memory: d.memory, text, status: "stored", blobId, ...(createdAt ? { createdAt } : {}) });
  }
  return { memories, dropped };
}

async function rebuildInto(s: StoreState): Promise<RebuildReport> {
  s.rebuildPromise ??= (async () => {
    const startedAt = new Date().toISOString();
    const c: Collected = { byBlob: new Map(), queries: [] };

    for (const q of BASE_QUERIES) await collect(c, q);

    let listed = 0;
    let inventoryError: string | undefined;
    try {
      listed = (await listAll()).length;
    } catch (err) {
      inventoryError = err instanceof Error ? err.message : String(err);
    }

    // Gap-filling: more specific queries until every listed blob is accounted for.
    if (!inventoryError && c.byBlob.size < listed) {
      const extra: Array<{ q: string; sort?: "recent" }> = EXTRA_KIND_QUERIES.map((q) => ({ q }));
      const addresses = new Set<string>();
      for (const { text } of c.byBlob.values()) {
        const d = decodeMemoryDetailed(text);
        if (d.ok && d.memory.kind === "wallet") addresses.add(`${d.memory.chain} ${shortAddress(d.memory.address)}`);
      }
      for (const a of addresses) {
        extra.push({ q: `${MEMORY_PREFIX} wallet ${a}` }, { q: `${MEMORY_PREFIX} fact where how who ${a}` }, { q: `${MEMORY_PREFIX} confirm ${a}` });
      }
      extra.push({ q: `${MEMORY_PREFIX} snapshot`, sort: "recent" }, { q: `${MEMORY_PREFIX} fact`, sort: "recent" }, { q: `${MEMORY_PREFIX} checkin`, sort: "recent" });
      for (const { q, sort } of extra) {
        if (c.byBlob.size >= listed) break;
        await collect(c, q, sort);
      }
    }

    const { memories, dropped } = decodeAll(c);

    // Keep this instance's own writes that recall can't find yet (pending, or stored but not
    // indexed), so a rebuild never hides a fresh answer. A clear-first rebuild starts empty.
    for (const [id, rec] of s.byId) {
      if (!memories.has(id) && rec.status !== "failed") memories.set(id, rec);
    }
    s.byId = memories;
    s.dropped = dropped;

    const restored = [...memories.values()].filter((m) => m.status === "stored").length;
    const complete = !inventoryError && restored + dropped >= listed;
    const report: RebuildReport = {
      restored,
      listed,
      dropped,
      queries: c.queries,
      complete,
      message: inventoryError
        ? `Restored ${restored} memories from Walrus; the inventory count is unavailable (${inventoryError}).`
        : complete
          ? `Restored ${restored} of ${listed} memories from Walrus${dropped ? ` (${dropped} unreadable and skipped)` : ""}.`
          : `Restored ${restored} of ${listed} memories from Walrus; ${listed - restored - dropped} could not be found by recall yet.`,
      startedAt,
      finishedAt: new Date().toISOString(),
      mode: memoryMode(),
      ...(inventoryError ? { inventoryError } : {}),
    };
    s.lastRebuild = report;
    s.loaded = true;
    await persist(s);
    return report;
  })().finally(() => {
    s.rebuildPromise = null;
  });
  return s.rebuildPromise;
}

/**
 * Rebuild the cache from Walrus Memory: broad recall queries (limit 100 each),
 * union by blob id, strict decode, then compare with the relayer inventory
 * and run targeted queries until complete — or report the gap honestly.
 */
export async function rebuildFromWalrus(opts: { clearFirst?: boolean } = {}): Promise<RebuildReport> {
  if (opts.clearFirst) await clear();
  const s = state();
  return rebuildInto(s);
}

/** Forget the local cache (memory + file). Walrus is untouched. */
export async function clear(): Promise<void> {
  const s = state();
  s.byId = new Map();
  s.loaded = false;
  s.loadPromise = null;
  s.lastRebuild = null;
  s.dropped = 0;
  try {
    await unlink(cachePath());
  } catch {
    /* no file */
  }
}
