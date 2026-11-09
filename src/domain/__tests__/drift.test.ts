import { describe, expect, it } from "vitest";
import { baselineFor, detectDrift, inferAssetMeta, walletBaseline } from "../drift";
import { foldMemories } from "../fold";
import { assetKeys } from "../ids";
import { ADDR_A, ADDR_B, POOL, USDC_TYPE, WA, WB, at, confirm, fact, stake, suiCoin, wallet } from "./helpers";

const KEY = assetKeys.suiCoin(ADDR_A, "0x2::sui::SUI");

function scenario(currentRaw: string | null, baselineRaw = "100") {
  const s = foldMemories([wallet(ADDR_A), fact(WA, "where", at(1), { [KEY]: baselineRaw })]);
  const assets = currentRaw === null ? [] : [suiCoin(ADDR_A, currentRaw, 1)];
  return detectDrift(assets, s);
}

describe("drift thresholds", () => {
  it.each([
    ["74", "dropped"],
    ["75", null],
    ["76", null],
    ["100", null],
    ["132", null],
    ["133", null],
    ["134", "grew"],
  ])("current %s of baseline 100 → %s", (current, reason) => {
    const r = scenario(current);
    expect(r.drifted[0]?.reason ?? null).toBe(reason);
  });

  it("flags an asset that vanished from a scanned wallet", () => {
    const r = scenario(null, "5000000000");
    expect(r.drifted).toEqual([
      { assetKey: KEY, walletId: WA, reason: "missing", baseline: "5000000000", current: "0", symbol: "SUI", decimals: 9 },
    ]);
  });

  it("does not flag missing assets for wallets that were not scanned", () => {
    const s = foldMemories([wallet(ADDR_A), fact(WA, "where", at(1), { [KEY]: "100" })]);
    expect(detectDrift([], s, { scannedWalletIds: new Set() }).drifted).toEqual([]);
  });

  it("uses BigInt math on large raw amounts", () => {
    const big = "123456789012345678901234567890";
    const r = scenario("92592591759259259175925925918", big); // just above 75% → not drift
    expect(r.drifted).toEqual([]);
  });
});

describe("baselines", () => {
  it("picks the latest of asset fact, confirm and latest wallet fact", () => {
    const s1 = foldMemories([wallet(ADDR_A), fact(WA, "where", at(1), { [KEY]: "100" }), confirm(KEY, "40", at(5))]);
    expect(baselineFor(KEY, s1)).toEqual({ amount: "40", source: "confirm", ts: at(5) });

    const s2 = foldMemories([wallet(ADDR_A), confirm(KEY, "40", at(5)), fact(WA, "who", at(7), { [KEY]: "55" })]);
    expect(baselineFor(KEY, s2)).toMatchObject({ amount: "55", source: "wallet-fact" });

    const s3 = foldMemories([wallet(ADDR_A), fact(WA, "who", at(7), { [KEY]: "55" }), fact(KEY, "how", at(8), { [KEY]: "60" })]);
    expect(baselineFor(KEY, s3)).toMatchObject({ amount: "60", source: "asset-fact" });
  });

  it("only reads the latest wallet-level fact's map", () => {
    const s = foldMemories([
      wallet(ADDR_A),
      fact(WA, "where", at(1), { [KEY]: "100" }),
      fact(WA, "how", at(4), { other: "1" }), // asset absent at the newer answer
    ]);
    expect(baselineFor(KEY, s)).toBeNull();
  });

  it("a confirm resolves drift by resetting the baseline", () => {
    const s = foldMemories([wallet(ADDR_A), fact(WA, "where", at(1), { [KEY]: "100" }), confirm(KEY, "20", at(9))]);
    expect(detectDrift([suiCoin(ADDR_A, "20", 1)], s).drifted).toEqual([]);
  });

  it("a confirmed spend (baseline 0) is never drift", () => {
    const s = foldMemories([wallet(ADDR_A), fact(WA, "where", at(1), { [KEY]: "100" }), confirm(KEY, "0", at(9))]);
    expect(detectDrift([], s).drifted).toEqual([]);
    expect(detectDrift([suiCoin(ADDR_A, "50", 1)], s)).toEqual({ drifted: [], newAssets: [KEY] });
  });

  it("walletBaseline captures every asset in the wallet", () => {
    const assets = [suiCoin(ADDR_A, "7", 1), stake(ADDR_A, "9", 1), suiCoin(ADDR_B, "1", 1)];
    expect(walletBaseline(assets, WA)).toEqual({ [assets[0]!.key]: "7", [assets[1]!.key]: "9" });
  });
});

describe("new assets", () => {
  it("are reported only once the wallet has a reviewed baseline", () => {
    const usdc = suiCoin(ADDR_B, "5000000", 5, USDC_TYPE);
    const before = foldMemories([wallet(ADDR_B)]);
    expect(detectDrift([usdc], before).newAssets).toEqual([]);

    const after = foldMemories([wallet(ADDR_B), fact(WB, "where", at(1), { other: "1" })]);
    expect(detectDrift([usdc], after).newAssets).toEqual([usdc.key]);
  });
});

describe("inferAssetMeta", () => {
  it("knows SUI, staked SUI, USDC and ETH", () => {
    expect(inferAssetMeta(KEY)).toEqual({ symbol: "SUI", decimals: 9 });
    expect(inferAssetMeta(assetKeys.suiStake(ADDR_A, POOL))).toEqual({ symbol: "SUI", decimals: 9 });
    expect(inferAssetMeta(assetKeys.suiCoin(ADDR_A, USDC_TYPE))).toEqual({ symbol: "USDC", decimals: 6 });
    expect(inferAssetMeta(assetKeys.ethNative("0xabc"))).toEqual({ symbol: "ETH", decimals: 18 });
    expect(inferAssetMeta(assetKeys.suiCoin(ADDR_A, "0x9::deep::DEEP"))).toEqual({ symbol: "DEEP", decimals: 0 });
  });
});
