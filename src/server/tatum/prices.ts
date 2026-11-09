import "server-only";
import { getEnv } from "../env";
import { TatumError, TtlCache, tatumFetch } from "./queue";

/** USD prices from the Tatum Data API, cached for 60 seconds. */

export interface Price {
  usd: number;
  /** e.g. "tatum:CoinGecko", or "peg-fallback" for stablecoins when the API fails */
  source: string;
  at: string;
}

const RATE_URL = "https://api.tatum.io/v4/data/rate/symbol";
const STABLECOINS = new Set(["USDC", "USDT", "WUSDC", "WUSDT", "USDY", "AUSD", "FDUSD"]);
const cache = new TtlCache<Price>();

export function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(symbol.toUpperCase());
}

async function fetchRate(symbol: string): Promise<Price> {
  const key = getEnv().tatumApiKey;
  if (!key) throw new TatumError("TATUM_API_KEY is not set", "data:rate", null);
  const url = `${RATE_URL}?symbol=${encodeURIComponent(symbol)}&basePair=USD`;
  const res = await tatumFetch(`data:rate:${symbol}`, url, { headers: { "x-api-key": key, accept: "application/json" } });
  if (!res.ok) throw new TatumError(`Tatum rate ${symbol}: HTTP ${res.status}`, "data:rate", res.status);
  const body = (await res.json()) as { value?: string | number; timestamp?: number | string; source?: string };
  const usd = Number(body.value);
  if (!Number.isFinite(usd) || usd <= 0) throw new TatumError(`Tatum rate ${symbol}: no usable value`, "data:rate", res.status);
  const ts = typeof body.timestamp === "number" ? new Date(body.timestamp).toISOString() : body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();
  return { usd, source: `tatum${body.source ? `:${body.source}` : ""}`, at: ts };
}

/**
 * Price for a symbol in USD, or null when unknown. Stablecoins fall back to
 * $1 (source "peg-fallback") if the API call fails.
 */
export async function priceUsd(symbol: string): Promise<Price | null> {
  const sym = symbol.toUpperCase();
  try {
    return await cache.getOrLoad(sym, 60_000, () => fetchRate(sym));
  } catch (err) {
    if (isStablecoin(sym)) return { usd: 1, source: "peg-fallback", at: new Date().toISOString() };
    console.warn(`[nok] price for ${sym} unavailable:`, err instanceof Error ? err.message : err);
    return null;
  }
}
