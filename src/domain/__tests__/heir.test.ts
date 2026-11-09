import { describe, expect, it } from "vitest";
import { buildGuide, buildRecoverySteps, orphanedAssetFacts } from "../heir";
import { assetKeys } from "../ids";
import { ADDR_A, ADDR_B, USDC_TYPE, WA, WB, stake, suiCoin } from "./helpers";
import type { Asset } from "../types";

describe("recovery steps", () => {
  it("tells the heir to unstake staked SUI and wait an epoch", () => {
    const steps = buildRecoverySteps(stake(ADDR_A, "20000000000", 60), { walletLabel: "Savings" });
    expect(steps.join(" ")).toMatch(/Staking/);
    expect(steps.join(" ")).toMatch(/Mysten Labs 1/);
    expect(steps.join(" ")).toMatch(/about 24 hours/);
    expect(steps[0]).toContain("‘Savings’");
  });

  it("reminds about SUI for gas when sending other coins", () => {
    expect(buildRecoverySteps(suiCoin(ADDR_B, "5000000", 5, USDC_TYPE)).join(" ")).toMatch(/pays the network fee/);
    expect(buildRecoverySteps(suiCoin(ADDR_B, "5000000000", 5)).join(" ")).not.toMatch(/pays the network fee/);
  });

  it("covers native ETH", () => {
    const eth: Asset = {
      key: assetKeys.ethNative("0xabc"),
      walletId: "ethereum:0xabc",
      chain: "ethereum",
      address: "0xabc",
      kind: "native",
      symbol: "ETH",
      decimals: 18,
      amountRaw: "1000000000000000",
      amount: 0.001,
      usd: 3,
      liquid: true,
      meta: {},
    };
    expect(buildRecoverySteps(eth).join(" ")).toMatch(/0.001 ETH/);
  });
});

describe("buildGuide", () => {
  it("groups facts and live assets per wallet, largest first", () => {
    const liquid = suiCoin(ADDR_A, "10000000000", 30);
    const staked = stake(ADDR_A, "20000000000", 60);
    const guide = buildGuide({
      wallets: [
        { walletId: WA, chain: "sui", address: ADDR_A, label: "Savings" },
        { walletId: WB, chain: "sui", address: ADDR_B, label: "Spending" },
      ],
      facts: [
        { target: WA, field: "where", value: "Slush on my phone" },
        { target: WA, field: "who", value: "My sisters" },
        { target: staked.key, field: "how", value: "Unstake from Mysten" },
      ],
      assets: [liquid, staked],
    });
    expect(guide).toHaveLength(2);
    expect(guide[0]).toMatchObject({ label: "Savings", where: "Slush on my phone", who: "My sisters", how: undefined });
    expect(guide[0]!.assets.map((a) => a.asset.key)).toEqual([staked.key, liquid.key]);
    expect(guide[0]!.assets[0]!.how).toBe("Unstake from Mysten");
    expect(guide[1]!.assets).toEqual([]);
  });

  it("finds facts about assets that are no longer on chain", () => {
    const gone = assetKeys.suiCoin(ADDR_A, USDC_TYPE);
    expect(orphanedAssetFacts([{ target: gone, field: "how", value: "x" }, { target: WA, field: "where", value: "y" }], [])).toHaveLength(1);
  });
});
