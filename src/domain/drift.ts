/**
 * Drift detection — memory verified against the chain.
 *
 * Baseline for an asset = the latest (by ts) of:
 *   - its asset-level fact baseline,
 *   - a `confirm` amount,
 *   - its entry in the baseline map of the latest wallet-level fact.
 *
 * Drifted when current < 75% of baseline, current > 133% of baseline, or the
 * asset is in a baseline but missing now. Decisions where the brief is silent:
 *   - A baseline of "0" (e.g. confirmed "spent") is never drift. If funds
 *     reappear on that key it is reported as a new asset instead.
 *   - "New since last review" requires the wallet to have at least one
 *     wallet-level fact with a baseline; otherwise every asset would be "new"
 *     on day one.
 *   - Missing detection only runs for wallets that were actually scanned.
 */
import { DRIFT_HIGH, DRIFT_LOW } from "./types";
import type { Asset, DriftItem, DriftReport, FactMemory, NokState } from "./types";
import { walletIdOfAssetKey } from "./ids";

export interface Baseline {
  amount: string;
  source: "asset-fact" | "confirm" | "wallet-fact";
  ts: string;
}

const LOW_PCT = BigInt(Math.round(DRIFT_LOW * 100)); // 75
const HIGH_PCT = BigInt(Math.round(DRIFT_HIGH * 100)); // 133

function later(a: Baseline | null, b: Baseline | null): Baseline | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.ts) > Date.parse(a.ts) ? b : a;
}

/** The latest wallet-level fact that carries a baseline map. */
export function latestWalletFact(state: NokState, walletId: string): FactMemory | null {
  let best: FactMemory | null = null;
  for (const f of state.facts) {
    if (f.target !== walletId || !f.baseline) continue;
    if (!best || Date.parse(f.ts) > Date.parse(best.ts) || (f.ts === best.ts && f.id > best.id)) best = f;
  }
  return best;
}

export function baselineFor(assetKey: string, state: NokState): Baseline | null {
  let best: Baseline | null = null;
  for (const f of state.facts) {
    if (f.target === assetKey && f.baseline && f.baseline[assetKey] !== undefined) {
      best = later(best, { amount: f.baseline[assetKey]!, source: "asset-fact", ts: f.ts });
    }
  }
  const c = state.confirms[assetKey];
  if (c) best = later(best, { amount: c.amount, source: "confirm", ts: c.ts });
  const wf = latestWalletFact(state, walletIdOfAssetKey(assetKey));
  if (wf?.baseline && wf.baseline[assetKey] !== undefined) {
    best = later(best, { amount: wf.baseline[assetKey]!, source: "wallet-fact", ts: wf.ts });
  }
  return best;
}

/** Symbol/decimals for an asset that is no longer on chain, inferred from its key. */
export function inferAssetMeta(assetKey: string): { symbol: string; decimals: number } {
  const parts = assetKey.split(":");
  const kind = parts[2];
  if (kind === "stake") return { symbol: "SUI", decimals: 9 };
  if (kind === "native") return parts[0] === "ethereum" ? { symbol: "ETH", decimals: 18 } : { symbol: "?", decimals: 0 };
  const coinType = parts.slice(3).join(":");
  const symbol = coinType.split("::").pop() ?? "?";
  if (/^0x0*2::sui::SUI$/.test(coinType)) return { symbol: "SUI", decimals: 9 };
  if (/::usdc::USDC$/i.test(coinType)) return { symbol: "USDC", decimals: 6 };
  // Unknown coin: decimals cannot be inferred offline; 0 means "raw units".
  return { symbol, decimals: 0 };
}

/** Every asset key that appears in any baseline source for this state. */
export function baselineKeys(state: NokState): Set<string> {
  const keys = new Set<string>();
  for (const f of state.facts) {
    if (f.target.split(":").length > 2 && f.baseline?.[f.target] !== undefined) keys.add(f.target);
  }
  for (const k of Object.keys(state.confirms)) keys.add(k);
  for (const w of state.wallets) {
    const wf = latestWalletFact(state, w.walletId);
    if (wf?.baseline) for (const k of Object.keys(wf.baseline)) keys.add(k);
  }
  return keys;
}

export function classifyDrift(baseline: bigint, current: bigint): DriftItem["reason"] | null {
  if (baseline <= BigInt(0)) return null;
  if (current * BigInt(100) < baseline * LOW_PCT) return "dropped";
  if (current * BigInt(100) > baseline * HIGH_PCT) return "grew";
  return null;
}

export function detectDrift(
  assets: ReadonlyArray<Asset>,
  state: NokState,
  opts: { scannedWalletIds?: ReadonlySet<string> } = {},
): DriftReport {
  const scanned = opts.scannedWalletIds ?? new Set(state.wallets.map((w) => w.walletId));
  const present = new Map(assets.map((a) => [a.key, a]));
  const drifted: DriftItem[] = [];
  const newAssets: string[] = [];

  for (const a of assets) {
    const b = baselineFor(a.key, state);
    const current = BigInt(a.amountRaw);
    if (!b) {
      if (latestWalletFact(state, a.walletId)) newAssets.push(a.key);
      continue;
    }
    const base = BigInt(b.amount);
    if (base === BigInt(0)) {
      if (current > BigInt(0)) newAssets.push(a.key);
      continue;
    }
    const reason = classifyDrift(base, current);
    if (reason) {
      drifted.push({
        assetKey: a.key,
        walletId: a.walletId,
        reason,
        baseline: b.amount,
        current: a.amountRaw,
        symbol: a.symbol,
        decimals: a.decimals,
      });
    }
  }

  for (const key of baselineKeys(state)) {
    if (present.has(key)) continue;
    const walletId = walletIdOfAssetKey(key);
    if (!scanned.has(walletId)) continue;
    const b = baselineFor(key, state);
    if (!b || BigInt(b.amount) === BigInt(0)) continue;
    const meta = inferAssetMeta(key);
    drifted.push({ assetKey: key, walletId, reason: "missing", baseline: b.amount, current: "0", ...meta });
  }

  drifted.sort((x, y) => (x.assetKey < y.assetKey ? -1 : x.assetKey > y.assetKey ? 1 : 0));
  newAssets.sort();
  return { drifted, newAssets };
}

/** Baseline map for a wallet-level fact: every asset currently in that wallet. */
export function walletBaseline(assets: ReadonlyArray<Asset>, walletId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of assets) if (a.walletId === walletId) out[a.key] = a.amountRaw;
  return out;
}
