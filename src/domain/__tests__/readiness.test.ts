import { describe, expect, it } from "vitest";
import { foldMemories } from "../fold";
import { computeReadiness } from "../readiness";
import { ADDR_A, ADDR_B, WA, WB, fact, stake, suiCoin, wallet } from "./helpers";

const liquidA = suiCoin(ADDR_A, "10000000000", 30); // 10 SUI, $30
const stakedA = stake(ADDR_A, "20000000000", 60); // 20 SUI, $60
const liquidB = suiCoin(ADDR_B, "3000000000", 10); // $10
const assets = [liquidA, stakedA, liquidB];
const none = new Set<string>();

function state(...facts: ReturnType<typeof fact>[]) {
  return foldMemories([wallet(ADDR_A), wallet(ADDR_B), ...facts]);
}

describe("computeReadiness", () => {
  it("is 0 with no answers", () => {
    const r = computeReadiness(assets, state(), none);
    expect(r).toMatchObject({ score: 0, basis: "usd", totalUsd: 100, coveredUsd: 0, covered: 0, assets: 3 });
    expect(r.perAsset.every((c) => !c.where && !c.how && !c.who && !c.covered)).toBe(true);
  });

  it("wallet-level where/how/who cover liquid assets but not staked ones", () => {
    const r = computeReadiness(assets, state(fact(WA, "where"), fact(WA, "how"), fact(WA, "who")), none);
    const byKey = Object.fromEntries(r.perAsset.map((c) => [c.assetKey, c]));
    expect(byKey[liquidA.key]?.covered).toBe(true);
    expect(byKey[stakedA.key]).toMatchObject({ where: true, how: false, who: true, covered: false });
    expect(r.score).toBe(30);
  });

  it("staked assets need their own how fact", () => {
    const r = computeReadiness(assets, state(fact(WA, "where"), fact(WA, "how"), fact(WA, "who"), fact(stakedA.key, "how")), none);
    expect(r.coveredUsd).toBe(90);
    expect(r.score).toBe(90);
  });

  it("asset-level how covers a liquid asset without a wallet-level how", () => {
    const r = computeReadiness(assets, state(fact(WB, "where"), fact(liquidB.key, "how"), fact(WB, "who")), none);
    expect(r.perAsset.find((c) => c.assetKey === liquidB.key)?.covered).toBe(true);
    expect(r.score).toBe(10);
  });

  it("asset-level who is enough; where must be wallet-level", () => {
    const s = state(fact(WB, "how"), fact(liquidB.key, "who"), fact(liquidB.key, "where"));
    const c = computeReadiness(assets, s, none).perAsset.find((x) => x.assetKey === liquidB.key);
    expect(c).toMatchObject({ who: true, how: true, where: false, covered: false });
  });

  it("drifted assets are not covered", () => {
    const s = state(fact(WA, "where"), fact(WA, "how"), fact(WA, "who"));
    const r = computeReadiness(assets, s, new Set([liquidA.key]));
    expect(r.perAsset.find((c) => c.assetKey === liquidA.key)).toMatchObject({ drifted: true, covered: false });
    expect(r.score).toBe(0);
  });

  it("falls back to asset count when no USD prices are known", () => {
    const noPrices = assets.map((a) => ({ ...a, usd: null }));
    const r = computeReadiness(noPrices, state(fact(WB, "where"), fact(WB, "how"), fact(WB, "who")), none);
    expect(r.basis).toBe("count");
    expect(r.score).toBe(33);
    expect(r.covered).toBe(1);
  });

  it("is 0 with no assets", () => {
    expect(computeReadiness([], state(), none)).toMatchObject({ score: 0, basis: "count", assets: 0 });
  });
});
