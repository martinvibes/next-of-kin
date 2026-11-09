import "server-only";
import { MemWal, MemWalMock, MemWalRateLimitedError } from "@mysten-incubation/memwal";
import type { MemorySummary, RecallMemory, RememberJobStatus, RestoreResult } from "@mysten-incubation/memwal";
import { getEnv, memoryMode, type MemoryMode } from "./env";

/**
 * Walrus Memory client. Mainnet when MEMWAL_ACCOUNT_ID + MEMWAL_PRIVATE_KEY are
 * set; otherwise the SDK's deterministic in-memory MemWalMock, and the UI must
 * show a red "MOCK MEMORY — not on Walrus" banner.
 */

type Client = MemWal | MemWalMock;

interface Holder {
  fingerprint: string;
  client: Client;
  mode: MemoryMode;
  namespace: string;
}

const g = globalThis as typeof globalThis & { __nokMemwal?: Holder };

export const RECALL_LIMIT_MAX = 100;

export class MemoryServiceError extends Error {
  constructor(
    message: string,
    readonly rateLimited: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "MemoryServiceError";
  }
}

function wrap(err: unknown, action: string): MemoryServiceError {
  if (err instanceof MemoryServiceError) return err;
  if (err instanceof MemWalRateLimitedError) {
    return new MemoryServiceError(`Walrus Memory is rate-limiting ${action}. Try again in ${err.retryAfterSeconds ?? "a few"} seconds.`, true, err.retryAfterSeconds);
  }
  const msg = err instanceof Error ? err.message : String(err);
  const rateLimited = /\b429\b|rate.?limit/i.test(msg);
  return new MemoryServiceError(`Walrus Memory ${action} failed: ${msg}`, rateLimited);
}

export function memoryClient(): Holder {
  const env = getEnv();
  const mode = memoryMode(env);
  const fingerprint = `${mode}|${env.namespace}|${env.serverUrl}|${env.memwal?.accountId ?? ""}`;
  if (g.__nokMemwal?.fingerprint === fingerprint) return g.__nokMemwal;
  const client: Client =
    mode === "mainnet" && env.memwal
      ? MemWal.create({ key: env.memwal.privateKey, accountId: env.memwal.accountId, serverUrl: env.serverUrl, namespace: env.namespace })
      : MemWalMock.create({ namespace: env.namespace });
  g.__nokMemwal = { fingerprint, client, mode, namespace: env.namespace };
  return g.__nokMemwal;
}

export interface MemoryHealth {
  ok: boolean;
  mode: MemoryMode;
  status: string;
  version?: string;
  writeReady?: boolean;
  serverUrl: string | null;
  error?: string;
}

/** Relayer health; public endpoint. Never throws. */
export async function health(): Promise<MemoryHealth> {
  const { client, mode } = memoryClient();
  const serverUrl = mode === "mainnet" ? getEnv().serverUrl : null;
  try {
    const h = await client.health();
    return { ok: h.status === "ok" || h.status === "healthy", mode, status: h.status, version: h.version, writeReady: h.write_ready, serverUrl };
  } catch (err) {
    return { ok: false, mode, status: "unreachable", serverUrl, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Delegate public key (64 hex). Believed to be the form's MEMWAL_AGENT_ID — confirm on the dashboard. Null in mock mode. */
export async function publicKeyHex(): Promise<string | null> {
  const { client } = memoryClient();
  if (!(client instanceof MemWal)) return null;
  try {
    return await client.getPublicKeyHex();
  } catch {
    return null;
  }
}

/** Owner Sui address the relayer resolved for this account. Null in mock mode or on failure. */
export async function ownerAddress(): Promise<string | null> {
  const { client } = memoryClient();
  if (!(client instanceof MemWal)) return null;
  try {
    // resolveOwner() is marked private in the SDK typings but is the SDK's own
    // memoised whoami (POST /api/stats). Used read-only for the proof page.
    return await (client as unknown as { resolveOwner(): Promise<string> }).resolveOwner();
  } catch {
    return null;
  }
}

/** Submit a write; returns as soon as the relayer accepts the job (writes take seconds). */
export async function rememberAsync(text: string, idempotencyKey: string): Promise<{ jobId: string; status: string }> {
  const { client } = memoryClient();
  try {
    const r = await client.rememberAsync(text, { idempotencyKey });
    return { jobId: r.job_id, status: r.status };
  } catch (err) {
    throw wrap(err, "write");
  }
}

export async function jobStatus(jobId: string): Promise<RememberJobStatus> {
  const { client } = memoryClient();
  try {
    return await client.getRememberStatus(jobId);
  } catch (err) {
    throw wrap(err, "status check");
  }
}

export async function recall(query: string, limit = RECALL_LIMIT_MAX, opts: { sort?: "relevance" | "recent" } = {}): Promise<RecallMemory[]> {
  const { client, namespace } = memoryClient();
  try {
    const r = await client.recall({ query, limit: Math.min(Math.max(1, limit), RECALL_LIMIT_MAX), namespace, ...(opts.sort ? { sort: opts.sort } : {}) });
    return r.results;
  } catch (err) {
    throw wrap(err, "recall");
  }
}

interface MockRecord {
  blobId: string;
  text: string;
  namespace: string;
  sequence: number;
}

/**
 * Inventory of every memory in our namespace (metadata only, no text).
 * The relayer lists across all namespaces and the SDK filters client-side,
 * so this paginates with has_more/next_cursor until exhausted.
 */
export async function listAll(): Promise<MemorySummary[]> {
  const { client, namespace } = memoryClient();
  if (client instanceof MemWalMock) {
    // MemWalMock has no listMemories; derive the same shape from its records.
    const records = (client as unknown as { memories: MockRecord[] }).memories.filter((m) => m.namespace === namespace);
    return records.map((m) => ({
      memory_id: m.blobId,
      namespace_id: namespace,
      blob_id: m.blobId,
      created_at: new Date(1_700_000_000_000 + m.sequence * 1000).toISOString(),
      updated_at: new Date(1_700_000_000_000 + m.sequence * 1000).toISOString(),
      size: new TextEncoder().encode(m.text).length,
      agent_id: null,
      package_id: null,
      status: "active",
      end_epoch: null,
      expires_at: null,
      importance: null,
    }));
  }
  try {
    const out: MemorySummary[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const res = await client.listMemories({ cursor, namespace });
      for (const m of res.memories) {
        if (seen.has(m.memory_id)) continue;
        seen.add(m.memory_id);
        out.push(m);
      }
      if (!res.has_more || !res.next_cursor || res.next_cursor === cursor) break;
      cursor = res.next_cursor;
    }
    return out.filter((m) => m.status !== "deleted");
  } catch (err) {
    throw wrap(err, "inventory");
  }
}

/** Ask the relayer to rebuild its index for our namespace from Walrus. */
export async function restore(limit = 100): Promise<RestoreResult> {
  const { client, namespace } = memoryClient();
  try {
    return await client.restore(namespace, limit);
  } catch (err) {
    throw wrap(err, "restore");
  }
}
