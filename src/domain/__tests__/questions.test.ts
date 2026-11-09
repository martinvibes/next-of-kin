import { describe, expect, it } from "vitest";
import { detectDrift } from "../drift";
import { foldMemories } from "../fold";
import { computeQuestions, renderQuestion } from "../questions";
import { computeReadiness } from "../readiness";
import type { Asset, NokMemory } from "../types";
import { ADDR_A, ADDR_B, WA, WB, at, fact, stake, suiCoin, wallet } from "./helpers";

const liquidA = suiCoin(ADDR_A, "300000000000", 900); // $900
const stakedA = stake(ADDR_A, "100000000000", 300); // $300
const liquidB = suiCoin(ADDR_B, "30000000000", 100); // $100
const ASSETS = [liquidA, stakedA, liquidB];

function run(mems: NokMemory[], assets: Asset[] = ASSETS) {
  const state = foldMemories([wallet(ADDR_A), wallet(ADDR_B), ...mems]);
  const drift = detectDrift(assets, state);
  return { state, drift, questions: computeQuestions(assets, state, drift) };
}

describe("computeQuestions", () => {
  it("on day one asks about the most valuable wallet first", () => {
    const { questions } = run([]);
    expect(questions.map((q) => q.id)).toEqual([
      `where:${WA}`,
      `who:${WA}`,
      `how:${WA}`,
      `how-stake:${stakedA.key}`,
      `where:${WB}`,
      `how:${WB}`,
      `who:${WB}`,
    ]);
    expect(questions.every((q) => q.impactPct === 0)).toBe(true);
    // Shares split each asset's slice across its missing answers and sum to the gap.
    const total = questions.reduce((n, q) => n + q.sharePct, 0);
    expect(total).toBeCloseTo(100, 0);
    expect(questions[0]!.sharePct).toBeCloseTo(((900 + 300) / 1300 / 3) * 100, 1);
  });

  it("ranks the answer that completes coverage by its real impact", () => {
    const { questions, state } = run([fact(WA, "where"), fact(WA, "who")]);
    const how = questions.find((q) => q.id === `how:${WA}`)!;
    const howStake = questions.find((q) => q.id === `how-stake:${stakedA.key}`)!;
    expect(how.impactPct).toBeCloseTo((900 / 1300) * 100, 1);
    expect(how.usdAtStake).toBe(900);
    expect(howStake.impactPct).toBeCloseTo((300 / 1300) * 100, 1);
    expect(questions[0]!.id).toBe(`how:${WA}`);
    expect(questions[1]!.id).toBe(`how-stake:${stakedA.key}`);
    // Answering it really does move the score by that much.
    const before = computeReadiness(ASSETS, state, new Set()).score;
    const after = computeReadiness(ASSETS, foldMemories([...allMems(state), fact(WA, "how", at(3))]), new Set()).score;
    expect(after - before).toBe(Math.round(how.impactPct));
  });

  it("puts drift first even when its impact is smaller", () => {
    const baseline = { [liquidB.key]: liquidB.amountRaw };
    const mems = [
      fact(WB, "where", at(1), baseline),
      fact(WB, "how", at(1), baseline),
      fact(WB, "who", at(1), baseline),
      fact(WA, "where", at(1)),
      fact(WA, "who", at(1)),
    ];
    const dropped = { ...liquidB, amountRaw: "1000000000", amount: 1, usd: 3 };
    const { questions, drift } = run(mems, [liquidA, stakedA, dropped]);
    expect(drift.drifted.map((d) => d.assetKey)).toEqual([liquidB.key]);
    expect(questions[0]!.kind).toBe("drift");
    expect(questions[0]!.impactPct).toBeLessThan(questions[1]!.impactPct);
  });

  it("asks where/who for an empty wallet, after everything else", () => {
    const { questions } = run([], [liquidA]);
    const tail = questions.slice(-2).map((q) => q.id);
    expect(tail).toEqual([`where:${WB}`, `who:${WB}`]);
    expect(questions.find((q) => q.id === `how:${WB}`)).toBeUndefined();
  });

  it("stops asking once everything is covered", () => {
    const { questions } = run([
      fact(WA, "where"),
      fact(WA, "how"),
      fact(WA, "who"),
      fact(stakedA.key, "how"),
      fact(WB, "where"),
      fact(WB, "how"),
      fact(WB, "who"),
    ]);
    expect(questions).toEqual([]);
  });

  it("asks the owner to review assets that appeared since the last review", () => {
    const { questions } = run([fact(WB, "where", at(1), { other: "1" })], [liquidB]);
    expect(questions.some((q) => q.kind === "new-asset" && q.assetKey === liquidB.key)).toBe(true);
  });
});

describe("renderQuestion", () => {
  const { questions } = run([]);
  it("uses the decrypted wallet label when available", () => {
    const where = renderQuestion(questions[0]!, { walletLabel: "Savings" });
    expect(where.title).toBe("Where is the key to ‘Savings’ (0xa1a1…a1a1)?");
    expect(where.hint).toMatch(/Never type the recovery phrase/);
    expect(renderQuestion(questions[0]!).title).toBe("Where is the key to your Sui wallet 0xa1a1…a1a1?");
  });

  it("pre-fills staked SUI recovery steps from the chain", () => {
    const q = questions.find((x) => x.kind === "how-stake")!;
    const r = renderQuestion(q);
    expect(r.prefill).toBe(
      "This is 100 SUI staked with Mysten Labs 1. To recover: open the wallet → Staking → withdraw from Mysten Labs 1. Funds return at the next epoch (~24h).",
    );
  });

  it("describes drift in plain words", () => {
    const baseline = { [liquidA.key]: "12500000000" };
    const { questions: qs } = run([fact(WA, "where", at(1), baseline)], [{ ...liquidA, amountRaw: "2100000000", amount: 2.1 }]);
    const d = qs.find((x) => x.kind === "drift")!;
    expect(renderQuestion(d, { walletLabel: "Savings" }).title).toBe(
      "Your 12.5 SUI in ‘Savings’ (0xa1a1…a1a1) dropped to 2.1 SUI. What happened?",
    );
  });
});

function allMems(state: ReturnType<typeof foldMemories>): NokMemory[] {
  return [...state.wallets, ...state.facts];
}
