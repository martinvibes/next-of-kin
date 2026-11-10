import "server-only";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { getEnv } from "../env";
import { TatumError, TtlCache, tatumFetch } from "./queue";

/**
 * Sui Mainnet reads via Tatum's Sui GraphQL gateway (Sui JSON-RPC is retired).
 * Every request goes through the throttled Tatum queue by passing a custom
 * fetch to the official SuiGraphQLClient.
 */

export const SUI_GRAPHQL_URL = "https://sui-mainnet.gateway.tatum.io/graphql";
export const SUI_COIN_TYPE = "0x2::sui::SUI";
const STAKED_SUI_TYPE = "0x3::staking_pool::StakedSui";
const HOUR = 3_600_000;

let cached: { key: string; client: SuiGraphQLClient } | null = null;

/** Label each GraphQL call by its operation name so the call counter is readable. */
function labelFor(init?: RequestInit): string {
  try {
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as { query?: string; operationName?: string }) : null;
    const name = body?.operationName ?? /(?:query|mutation)\s+(\w+)/.exec(body?.query ?? "")?.[1];
    return `sui-graphql:${name ?? "query"}`;
  } catch {
    return "sui-graphql:query";
  }
}

export function suiClient(): SuiGraphQLClient {
  const key = getEnv().tatumApiKey;
  if (!key) throw new TatumError("TATUM_API_KEY is not set", "sui-graphql", null);
  if (cached?.key === key) return cached.client;
  const client = new SuiGraphQLClient({
    url: SUI_GRAPHQL_URL,
    network: "mainnet",
    headers: { "x-api-key": key },
    fetch: ((input: string | URL | Request, init?: RequestInit) => tatumFetch(labelFor(init), input, init)) as typeof fetch,
  });
  cached = { key, client };
  return client;
}

// ─── Balances ───────────────────────────────────────────────────────────────

export interface SuiBalance {
  coinType: string;
  /** total raw balance (coin objects + address balance) */
  balance: string;
}

export async function listAllBalances(address: string): Promise<SuiBalance[]> {
  const client = suiClient();
  const out: SuiBalance[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res = await client.listBalances({ owner: address, limit: 50, cursor });
    for (const b of res.balances) if (b.coinType) out.push({ coinType: b.coinType, balance: b.balance ?? "0" });
    if (!res.hasNextPage || !res.cursor) break;
    cursor = res.cursor;
  }
  return out;
}

// ─── Coin metadata ──────────────────────────────────────────────────────────

export interface SuiCoinMeta {
  decimals: number;
  symbol: string;
  name: string;
  iconUrl: string | null;
}

const metaCache = new TtlCache<SuiCoinMeta | null>();

/** Metadata is immutable in practice, so cache it for an hour. SUI itself needs no call. */
export function coinMetadata(coinType: string): Promise<SuiCoinMeta | null> {
  if (normalizeCoinType(coinType) === SUI_COIN_TYPE) {
    return Promise.resolve({ decimals: 9, symbol: "SUI", name: "Sui", iconUrl: null });
  }
  return metaCache.getOrLoad(coinType, HOUR, async () => {
    const { coinMetadata: m } = await suiClient().getCoinMetadata({ coinType });
    return m ? { decimals: m.decimals, symbol: m.symbol, name: m.name, iconUrl: m.iconUrl } : null;
  });
}

/** 0x000…02::sui::SUI → 0x2::sui::SUI so lookups line up. */
export function normalizeCoinType(coinType: string): string {
  return coinType.replace(/^0x0+([0-9a-f])/i, "0x$1");
}

// ─── Staked SUI ─────────────────────────────────────────────────────────────

export interface StakedSuiPosition {
  objectId: string;
  poolId: string;
  principalRaw: string;
  activationEpoch: string | null;
}

function asRaw(v: unknown): string | null {
  if (typeof v === "string" && /^\d+$/.test(v)) return v;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v).toString();
  if (typeof v === "bigint") return v.toString();
  if (v && typeof v === "object" && "value" in v) return asRaw((v as { value: unknown }).value);
  return null;
}

function asId(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return asId(o.id ?? o.bytes ?? null);
  }
  return null;
}

export async function stakedSui(address: string): Promise<StakedSuiPosition[]> {
  const client = suiClient();
  const out: StakedSuiPosition[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res: Awaited<ReturnType<typeof client.listOwnedObjects<{ json: true }>>> = await client.listOwnedObjects({
      owner: address,
      type: STAKED_SUI_TYPE,
      include: { json: true },
      limit: 50,
      cursor,
    });
    for (const o of res.objects) {
      const json = o.json ?? {};
      const poolId = asId(json.pool_id);
      const principalRaw = asRaw(json.principal);
      if (!poolId || !principalRaw) continue;
      out.push({ objectId: o.objectId, poolId, principalRaw, activationEpoch: asRaw(json.stake_activation_epoch) });
    }
    if (!res.hasNextPage || !res.cursor) break;
    cursor = res.cursor;
  }
  return out;
}

// ─── Liveness ───────────────────────────────────────────────────────────────

/**
 * How far back to look for the owner's last transaction. Gateways prune old history and
 * reject scans that start below their earliest checkpoint, so the scan starts here.
 * About 20M checkpoints is roughly two months, far longer than any check-in interval.
 */
const SENT_WINDOW = 20_000_000;
let checkpointCache: { at: number; seq: number } | null = null;

async function recentCheckpointFloor(): Promise<number> {
  if (!checkpointCache || Date.now() - checkpointCache.at > 60_000) {
    const cp = await latestCheckpoint();
    checkpointCache = { at: Date.now(), seq: Number(cp.sequenceNumber) };
  }
  return Math.max(0, checkpointCache.seq - SENT_WINDOW);
}

/** Timestamp of the latest transaction this address SENT (failed ones count: the owner still signed). */
export async function lastOutgoingTx(address: string): Promise<string | null> {
  const after = await recentCheckpointFloor();
  const data = await rawQuery<{ transactions: { nodes: { effects: { timestamp: string | null } | null }[] } | null }>(
    "query nokLastSent($a: SuiAddress!, $after: UInt53!) { transactions(last: 1, filter: { sentAddress: $a, afterCheckpoint: $after }) { nodes { effects { timestamp } } } }",
    { a: address, after },
  );
  const ts = data.transactions?.nodes[0]?.effects?.timestamp;
  return ts ? new Date(ts).toISOString() : null;
}

// ─── Raw queries ────────────────────────────────────────────────────────────

async function rawQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await suiClient().query<T, Record<string, unknown>>({ query, variables });
  if (res.errors?.length) throw new TatumError(`Sui GraphQL: ${res.errors.map((e) => e.message).join("; ")}`, "sui-graphql", 200);
  if (!res.data) throw new TatumError("Sui GraphQL returned no data", "sui-graphql", 200);
  return res.data;
}

export interface CheckpointInfo {
  sequenceNumber: string;
  timestamp: string;
  digest: string | null;
}

export async function latestCheckpoint(): Promise<CheckpointInfo> {
  const data = await rawQuery<{ checkpoint: { sequenceNumber: string | number; timestamp: string; digest?: string } | null }>(
    "query nokLatestCheckpoint { checkpoint { sequenceNumber timestamp digest } }",
  );
  if (!data.checkpoint) throw new TatumError("No checkpoint returned", "sui-graphql", 200);
  return {
    sequenceNumber: String(data.checkpoint.sequenceNumber),
    timestamp: data.checkpoint.timestamp,
    digest: data.checkpoint.digest ?? null,
  };
}

const validatorCache = new TtlCache<Map<string, string>>();

const VALIDATORS_QUERY = `query nokValidators($c: String) {
  epoch {
    validatorSet {
      activeValidators(first: 50, after: $c) {
        pageInfo { hasNextPage endCursor }
        nodes { contents { json } }
      }
    }
  }
}`;

interface ValidatorsPage {
  epoch: {
    validatorSet: {
      activeValidators: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{ contents: { json: unknown } | null }>;
      } | null;
    } | null;
  } | null;
}

/**
 * Map staking pool id → validator name, cached for an hour. Never throws:
 * on failure it returns an empty map and callers show a shortened pool id.
 */
export async function validatorNames(): Promise<Map<string, string>> {
  try {
    return await validatorCache.getOrLoad("active", HOUR, async () => {
      const names = new Map<string, string>();
      let cursor: string | null = null;
      for (let page = 0; page < 10; page++) {
        const data: ValidatorsPage = await rawQuery<ValidatorsPage>(VALIDATORS_QUERY, { c: cursor });
        const conn = data.epoch?.validatorSet?.activeValidators;
        if (!conn) break;
        for (const node of conn.nodes) {
          const json = node.contents?.json as { metadata?: { name?: unknown }; staking_pool?: { id?: unknown } } | undefined;
          const name = typeof json?.metadata?.name === "string" ? json.metadata.name : null;
          const poolId = asId(json?.staking_pool?.id);
          if (name && poolId) names.set(normalizeId(poolId), name);
        }
        if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
        cursor = conn.pageInfo.endCursor;
      }
      if (names.size === 0) throw new Error("no validators parsed");
      return names;
    });
  } catch (err) {
    console.warn("[nok] validator names unavailable:", err instanceof Error ? err.message : err);
    return new Map();
  }
}

/** Lowercase, 0x-prefixed, 64-hex. */
export function normalizeId(id: string): string {
  const hex = id.toLowerCase().replace(/^0x/, "");
  return `0x${hex.padStart(64, "0")}`;
}
