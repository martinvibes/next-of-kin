import "server-only";

/**
 * Every Tatum request goes through one throttled queue.
 *
 * The free plan allows roughly 3 requests/second, so request *starts* are
 * spaced by a minimum gap (default 350 ms). Requests may overlap in flight.
 * 429 / 5xx / network failures are retried with backoff (max 3 retries),
 * honouring Retry-After. Every HTTP attempt is counted, because every attempt
 * is a call against the plan.
 */

export interface TatumCallStats {
  total: number;
  byLabel: Record<string, number>;
  retries: number;
  errors: number;
  lastError: { label: string; message: string; at: string } | null;
  since: string;
}

export class TatumError extends Error {
  constructor(
    message: string,
    readonly label: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "TatumError";
  }
}

interface QueueState {
  stats: TatumCallStats;
  nextSlot: number;
  minGapMs: number;
}

const g = globalThis as typeof globalThis & { __nokTatumQueue?: QueueState };
const state: QueueState = (g.__nokTatumQueue ??= {
  stats: { total: 0, byLabel: {}, retries: 0, errors: 0, lastError: null, since: new Date().toISOString() },
  nextSlot: 0,
  minGapMs: 350,
});

export const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export function setMinGap(ms: number): void {
  state.minGapMs = Math.max(0, ms);
}

export function tatumStats(): TatumCallStats {
  return { ...state.stats, byLabel: { ...state.stats.byLabel } };
}

/** Total calls so far; take a before/after delta to count calls made by one operation. */
export function tatumCallCount(): number {
  return state.stats.total;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Reserve the next start slot synchronously, then wait for it. */
function acquireSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, state.nextSlot);
  state.nextSlot = at + state.minGapMs;
  const wait = at - now;
  return wait > 0 ? sleep(wait) : Promise.resolve();
}

function recordError(label: string, message: string): void {
  state.stats.errors += 1;
  state.stats.lastError = { label, message: message.slice(0, 300), at: new Date().toISOString() };
}

function retryDelay(attempt: number, res?: Response): number {
  const header = res?.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.min(10_000, Math.max(250, secs * 1000));
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.min(10_000, Math.max(250, date - Date.now()));
  }
  return 500 * 2 ** attempt + Math.floor(Math.random() * 150);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Throttled fetch with retries. Returns the final Response (which may be a
 * non-retryable 4xx — callers decide). Throws TatumError when retries are
 * exhausted on 429/5xx or the network fails.
 */
export async function tatumFetch(label: string, input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  let lastRes: Response | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      state.stats.retries += 1;
      await sleep(retryDelay(attempt - 1, lastRes));
    }
    await acquireSlot();
    state.stats.total += 1;
    state.stats.byLabel[label] = (state.stats.byLabel[label] ?? 0) + 1;
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      const res = await fetch(input, { ...init, signal });
      if (!isRetryableStatus(res.status)) {
        if (!res.ok) recordError(label, `HTTP ${res.status}`);
        return res;
      }
      lastRes = res;
      lastErr = undefined;
      recordError(label, `HTTP ${res.status}`);
      // drain the body so the connection can be reused
      await res.text().catch(() => undefined);
    } catch (err) {
      if (init.signal?.aborted) throw err;
      lastRes = undefined;
      lastErr = err;
      recordError(label, err instanceof Error ? err.message : String(err));
    }
  }
  if (lastRes) throw new TatumError(`Tatum ${label} failed after ${MAX_RETRIES} retries: HTTP ${lastRes.status}`, label, lastRes.status);
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new TatumError(`Tatum ${label} network error after ${MAX_RETRIES} retries: ${msg}`, label, null);
}

/** Small TTL cache with in-flight de-duplication. */
export class TtlCache<V> {
  private values = new Map<string, { value: V; expires: number }>();
  private inflight = new Map<string, Promise<V>>();

  get(key: string): V | undefined {
    const hit = this.values.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.values.set(key, { value, expires: Date.now() + ttlMs });
  }

  async getOrLoad(key: string, ttlMs: number, load: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const p = load()
      .then((v) => {
        this.set(key, v, ttlMs);
        return v;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  clear(): void {
    this.values.clear();
  }
}
