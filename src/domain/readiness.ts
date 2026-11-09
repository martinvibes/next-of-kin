/**
 * Heir readiness — deterministic, shown on screen.
 *
 * An asset is COVERED when all three hold and it is not drifted:
 *   WHERE  the wallet has a `where` fact
 *   HOW    the asset has a `how` fact, OR the asset is liquid AND the wallet has a `how` fact
 *   WHO    the asset has a `who` fact OR the wallet has a `who` fact
 *
 * Score = coveredUsd / totalUsd × 100 when totalUsd > 0,
 *         otherwise covered count / asset count × 100.
 */
import { factKey } from "./fold";
import type { Asset, AssetCoverage, FactField, FactMemory, NokState, Readiness } from "./types";

/** Set of `${target}|${field}` for every fact present. */
export type FactLookup = ReadonlySet<string>;

export function buildFactLookup(facts: ReadonlyArray<Pick<FactMemory, "target" | "field">>): Set<string> {
  return new Set(facts.map((f) => factKey(f.target, f.field)));
}

function has(lookup: FactLookup, target: string, field: FactField): boolean {
  return lookup.has(factKey(target, field));
}

export function coverageFor(asset: Asset, lookup: FactLookup, drifted: boolean): AssetCoverage {
  const where = has(lookup, asset.walletId, "where");
  const how = has(lookup, asset.key, "how") || (asset.liquid && has(lookup, asset.walletId, "how"));
  const who = has(lookup, asset.key, "who") || has(lookup, asset.walletId, "who");
  return { assetKey: asset.key, where, how, who, drifted, covered: where && how && who && !drifted };
}

export interface ReadinessExact extends Omit<Readiness, "score"> {
  /** unrounded score in points, 0..100 */
  exact: number;
}

export function readinessExact(assets: ReadonlyArray<Asset>, lookup: FactLookup, drifted: ReadonlySet<string>): ReadinessExact {
  let totalUsd = 0;
  let coveredUsd = 0;
  let covered = 0;
  const perAsset: AssetCoverage[] = [];
  for (const a of assets) {
    const c = coverageFor(a, lookup, drifted.has(a.key));
    perAsset.push(c);
    const usd = a.usd ?? 0;
    totalUsd += usd;
    if (c.covered) {
      covered++;
      coveredUsd += usd;
    }
  }
  const basis: Readiness["basis"] = totalUsd > 0 ? "usd" : "count";
  const exact =
    basis === "usd" ? (coveredUsd / totalUsd) * 100 : assets.length > 0 ? (covered / assets.length) * 100 : 0;
  return { exact, basis, coveredUsd, totalUsd, covered, assets: assets.length, perAsset };
}

export function computeReadiness(assets: ReadonlyArray<Asset>, state: NokState, drifted: ReadonlySet<string>): Readiness {
  const r = readinessExact(assets, buildFactLookup(state.facts), drifted);
  const { exact, ...rest } = r;
  return { ...rest, score: Math.round(exact) };
}
