import { describe, expect, it } from "vitest";
import { findFact, foldMemories } from "../fold";
import type { NokMemory } from "../types";
import { ADDR_A, ADDR_B, WA, WB, at, checkin, confirm, fact, letter, profile, snapshot, uid, wallet } from "./helpers";

describe("foldMemories", () => {
  it("returns empty state for no memories", () => {
    const s = foldMemories([]);
    expect(s.profile).toBeNull();
    expect(s.wallets).toEqual([]);
    expect(s.counts.total).toBe(0);
    expect(s.counts.byKind.fact).toBe(0);
  });

  it("latest ts wins per key", () => {
    const p1 = profile(180, at(0));
    const p2 = profile(30 * 86400, at(10));
    const f1 = fact(WA, "where", at(1));
    const f2 = fact(WA, "where", at(5));
    const fHow = fact(WA, "how", at(2));
    const c1 = confirm("sui:x:coin:y", "1", at(3));
    const c2 = confirm("sui:x:coin:y", "2", at(4));
    const l1 = letter(at(1));
    const l2 = letter(at(8));
    const s = foldMemories([p2, f2, c2, l1, p1, f1, fHow, c1, l2]);
    expect(s.profile?.id).toBe(p2.id);
    expect(s.profileCreatedAt).toBe(p1.ts);
    expect(findFact(s, WA, "where")?.id).toBe(f2.id);
    expect(findFact(s, WA, "how")?.id).toBe(fHow.id);
    expect(s.facts).toHaveLength(2);
    expect(s.confirms["sui:x:coin:y"]?.amount).toBe("2");
    expect(s.letter?.id).toBe(l2.id);
  });

  it("breaks ts ties by id, independent of input order", () => {
    const a = fact(WA, "who", at(3), undefined, uid(100));
    const b = fact(WA, "who", at(3), undefined, uid(200));
    expect(findFact(foldMemories([a, b]), WA, "who")?.id).toBe(b.id);
    expect(findFact(foldMemories([b, a]), WA, "who")?.id).toBe(b.id);
  });

  it("dedupes by memory id and counts by kind", () => {
    const w = wallet(ADDR_A);
    const c = checkin(at(2));
    const s = foldMemories([w, w, c, c, checkin(at(6))]);
    expect(s.counts.total).toBe(3);
    expect(s.counts.byKind.wallet).toBe(1);
    expect(s.counts.byKind.checkin).toBe(2);
    expect(s.checkinCount).toBe(2);
    expect(s.lastCheckin).toBe(at(6));
  });

  it("keeps wallets in order of first appearance with their latest version", () => {
    const b1 = wallet(ADDR_B, at(1));
    const a1 = wallet(ADDR_A, at(2));
    const b2 = wallet(ADDR_B, at(9));
    const s = foldMemories([a1, b2, b1]);
    expect(s.wallets.map((w) => w.walletId)).toEqual([WB, WA]);
    expect(s.wallets[0]?.id).toBe(b2.id);
  });

  it("sorts snapshots and is order-independent", () => {
    const mems: NokMemory[] = [snapshot(20, at(3)), snapshot(60, at(9)), snapshot(40, at(5)), wallet(ADDR_A), profile()];
    const s1 = foldMemories(mems);
    const s2 = foldMemories([...mems].reverse());
    expect(s1.snapshots.map((x) => x.score)).toEqual([20, 40, 60]);
    expect(s2).toEqual(s1);
  });
});
