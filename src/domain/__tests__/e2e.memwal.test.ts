/**
 * End-to-end through Walrus Memory's own mock (same API as the Mainnet client):
 * setup → wallet → encrypted facts → readiness rises → drift → confirm →
 * switch fires → the heir rebuilds from memory and decrypts the guide.
 */
import { describe, expect, it } from "vitest";
import { MemWalMock } from "@mysten-incubation/memwal";
import { decodeMemory, encodeMemory } from "../codec";
import { createVault, decryptField, encryptField, unlockVault } from "../crypto";
import { detectDrift, walletBaseline } from "../drift";
import { foldMemories } from "../fold";
import { buildGuide } from "../heir";
import { walletIdOf } from "../ids";
import { computeQuestions } from "../questions";
import { computeReadiness } from "../readiness";
import { computeSwitch } from "../switch";
import type { Asset, NokMemory, NokState } from "../types";
import { ADDR_A, at, stake, suiCoin, uid } from "./helpers";

const NAMESPACE = "next-of-kin";
const PASSPHRASE = "river lamp quiet orange window";
const QUERIES = [
  "Next of Kin wallet",
  "Next of Kin fact",
  "Next of Kin snapshot",
  "Next of Kin checkin",
  "Next of Kin profile vault letter confirm release",
];

async function remember(mw: MemWalMock, m: NokMemory) {
  const accepted = await mw.remember(encodeMemory(m), { idempotencyKey: m.id });
  const done = await mw.waitForRememberJob(accepted.job_id);
  expect(done.blob_id).toBeTruthy();
  return done;
}

async function rebuild(mw: MemWalMock): Promise<{ state: NokState; texts: string[] }> {
  const byBlob = new Map<string, string>();
  for (const query of QUERIES) {
    const r = await mw.recall({ query, limit: 100, namespace: NAMESPACE });
    for (const hit of r.results) byBlob.set(hit.blob_id, hit.text);
  }
  const texts = [...byBlob.values()];
  const memories = texts.map(decodeMemory).filter((m): m is NokMemory => m !== null);
  return { state: foldMemories(memories), texts };
}

function score(assets: Asset[], state: NokState) {
  const drift = detectDrift(assets, state);
  return { drift, readiness: computeReadiness(assets, state, new Set(drift.drifted.map((d) => d.assetKey))) };
}

describe("e2e with MemWalMock", () => {
  it("runs the whole learning loop and the heir can decrypt the guide", async () => {
    const mw = MemWalMock.create({ namespace: NAMESPACE });
    const WA = walletIdOf("sui", ADDR_A);
    const liquid = suiCoin(ADDR_A, "40000000000", 120); // 40 SUI
    const staked = stake(ADDR_A, "60000000000", 180); // 60 SUI staked
    let assets: Asset[] = [liquid, staked];

    // 1. Setup: vault + profile (3-minute demo interval).
    const { vault, key } = await createVault(PASSPHRASE, { iter: 100_000 }) // codec floor; production uses 310k;
    await remember(mw, { v: 1, id: uid(), kind: "vault", ts: at(0), ...vault });
    await remember(mw, {
      v: 1,
      id: uid(),
      kind: "profile",
      ts: at(0),
      ownerName: await encryptField(key, "Tolu Bakare"),
      heirName: await encryptField(key, "Ada Bakare"),
      heirContact: await encryptField(key, "ada@example.com"),
      intervalSec: 180,
      graceSec: 45,
    });

    // 2. Watch a wallet.
    await remember(mw, { v: 1, id: uid(), kind: "wallet", ts: at(0.1), walletId: WA, chain: "sui", address: ADDR_A, label: await encryptField(key, "Savings") });

    let { state } = await rebuild(mw);
    expect(state.wallets).toHaveLength(1);
    expect(score(assets, state).readiness.score).toBe(0);
    let questions = computeQuestions(assets, state, score(assets, state).drift);
    expect(questions[0]!.id).toBe(`where:${WA}`);

    // 3. Answer the questions, highest impact first, until nothing is left.
    const answers: Record<string, string> = {
      [`where:${WA}`]: "Slush app on my phone; recovery sheet in the fireproof box",
      [`who:${WA}`]: "Everything to Ada",
      [`how:${WA}`]: "Phone PIN is with my lawyer; open Slush → Unlock",
      [`how-stake:${staked.key}`]: "Withdraw the stake in Slush → Staking, wait one epoch",
    };
    const scores: number[] = [0];
    let minute = 1;
    while (questions.length > 0) {
      const q = questions[0]!;
      const value = answers[q.id];
      expect(value, `unexpected question ${q.id}`).toBeDefined();
      const baseline = q.target === WA ? walletBaseline(assets, WA) : { [q.target]: assets.find((a) => a.key === q.target)!.amountRaw };
      await remember(mw, { v: 1, id: uid(), kind: "fact", ts: at(minute++), target: q.target, field: q.field!, value: await encryptField(key, value!), baseline });
      ({ state } = await rebuild(mw));
      const s = score(assets, state).readiness.score;
      if (s !== scores.at(-1)) {
        await remember(mw, { v: 1, id: uid(), kind: "snapshot", ts: at(minute++), score: s, coveredUsd: s * 3, totalUsd: 300, assets: 2, covered: s === 100 ? 2 : 1, cause: `answered ${q.field}` });
        scores.push(s);
      }
      questions = computeQuestions(assets, state, score(assets, state).drift);
    }
    ({ state } = await rebuild(mw));
    expect(score(assets, state).readiness.score).toBe(100);
    expect(scores).toEqual([0, 60, 100]); // the bigger stake ($180) is asked and covered before the liquid $120
    expect(state.snapshots.map((s) => s.score)).toEqual([60, 100]);

    // Nothing sensitive ever reached the relayer in plaintext.
    const { texts } = await rebuild(mw);
    for (const t of texts) {
      expect(t).not.toMatch(/fireproof|Ada|Savings|Tolu|lawyer/);
    }

    // 4. The owner moves most of the liquid SUI → the next scan catches it.
    assets = [{ ...liquid, amountRaw: "10000000000", amount: 10, usd: 30 }, staked];
    let r = score(assets, state);
    expect(r.drift.drifted).toMatchObject([{ assetKey: liquid.key, reason: "dropped" }]);
    expect(r.readiness.perAsset.find((c) => c.assetKey === liquid.key)?.covered).toBe(false);
    expect(computeQuestions(assets, state, r.drift)[0]!.kind).toBe("drift");

    // 5. One-click resolve: "I moved it".
    await remember(mw, { v: 1, id: uid(), kind: "confirm", ts: at(minute++), assetKey: liquid.key, amount: "10000000000", resolution: "moved", note: await encryptField(key, "Moved 30 SUI to my Ledger") });
    ({ state } = await rebuild(mw));
    r = score(assets, state);
    expect(r.drift.drifted).toEqual([]);
    expect(r.readiness.score).toBe(100);

    // 6. A letter, a check-in, then silence.
    await remember(mw, { v: 1, id: uid(), kind: "letter", ts: at(minute++), value: await encryptField(key, "Ada — everything you need is here. Love, Mum.") });
    const checkinMinute = minute++;
    const checkinAt = at(checkinMinute);
    await remember(mw, { v: 1, id: uid(), kind: "checkin", ts: checkinAt });
    ({ state } = await rebuild(mw));
    const switchAt = (m: number) =>
      computeSwitch({ profile: state.profile, profileCreatedAt: state.profileCreatedAt, lastCheckin: state.lastCheckin, lastOnchain: null, onchainAvailable: true, now: at(m) });
    expect(switchAt(checkinMinute + 1).phase).toBe("alive");
    expect(switchAt(checkinMinute + 3.2).phase).toBe("overdue");
    const fired = switchAt(checkinMinute + 4);
    expect(fired.phase).toBe("released");
    await remember(mw, { v: 1, id: uid(), kind: "release", ts: at(checkinMinute + 4), reason: "No check-in or on-chain activity for 3 minutes plus grace", lastCheckin: checkinAt, lastOnchain: null, verifiedVia: "tatum" });

    // 7. The heir: a fresh rebuild from Walrus Memory + the passphrase from the will.
    const heir = await rebuild(mw);
    expect(heir.state.releases).toHaveLength(1);
    expect(heir.state.counts.total).toBe(heir.texts.length);
    expect(await unlockVault(heir.state.vault!, "wrong guess")).toBeNull();
    const heirKey = await unlockVault(heir.state.vault!, PASSPHRASE);
    expect(heirKey).not.toBeNull();
    const letterText = await decryptField(heirKey!, heir.state.letter!.value);
    expect(letterText).toContain("everything you need");
    const label = await decryptField(heirKey!, heir.state.wallets[0]!.label);
    const facts = await Promise.all(heir.state.facts.map(async (f) => ({ target: f.target, field: f.field, value: await decryptField(heirKey!, f.value) })));
    const guide = buildGuide({ wallets: [{ walletId: WA, chain: "sui", address: ADDR_A, label }], facts, assets });
    expect(guide[0]).toMatchObject({ label: "Savings", where: expect.stringContaining("fireproof box"), who: "Everything to Ada" });
    expect(guide[0]!.assets[0]!.asset.kind).toBe("stake");
    expect(guide[0]!.assets[0]!.how).toContain("one epoch");
    expect(guide[0]!.assets[0]!.steps.join(" ")).toMatch(/Staking/);
  });

  it("drops memories it can't decode instead of trusting them", async () => {
    const mw = MemWalMock.create({ namespace: NAMESPACE });
    await mw.rememberAndWait("Next of Kin · wallet · something without a token");
    await mw.rememberAndWait("Next of Kin · forged ⟦nok:v1:eyJ2IjoxfQ.AAAAAAAAAAAA⟧");
    const { state, texts } = await rebuild(mw);
    expect(texts).toHaveLength(2);
    expect(state.counts.total).toBe(0);
  });
});
