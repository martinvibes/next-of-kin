import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { decodeMemory, decodeMemoryDetailed, encodeMemory, MEMORY_PREFIX, parseMemory, summarize } from "../codec";
import { bytesToB64url, utf8ToB64url } from "../b64";
import type { NokMemory } from "../types";
import { ADDR_A, ENC, POOL, WA, at, checkin, confirm, fact, letter, profile, snapshot, uid, wallet } from "./helpers";
import { assetKeys } from "../ids";

const STAKE_KEY = assetKeys.suiStake(ADDR_A, POOL);

const samples: NokMemory[] = [
  { v: 1, id: uid(), kind: "vault", ts: at(0), salt: "c2FsdHNhbHRzYWx0c2FsdA", iter: 310_000, check: ENC.enc },
  profile(),
  wallet(ADDR_A),
  fact(WA, "where", at(1), { [STAKE_KEY]: "5000000000" }),
  fact(STAKE_KEY, "how", at(2)),
  confirm(STAKE_KEY, "4000000000"),
  { ...confirm(STAKE_KEY, "0"), resolution: "spent", note: ENC },
  letter(),
  checkin(at(3)),
  { ...snapshot(42, at(4)), cause: "answered where · 0xa1a1…a1a1" },
  { v: 1, id: uid(), kind: "release", ts: at(9), reason: "no check-in for 3 minutes + grace", lastCheckin: at(3), lastOnchain: null, verifiedVia: "tatum" },
];

function tokenFor(payloadJson: string): string {
  const payload = utf8ToB64url(payloadJson);
  const check = bytesToB64url(sha256(new TextEncoder().encode(payload))).slice(0, 12);
  return `${MEMORY_PREFIX} · forged ⟦nok:v1:${payload}.${check}⟧`;
}

describe("codec", () => {
  it.each(samples.map((m) => [m.kind, m] as const))("round-trips a %s memory", (_k, m) => {
    const text = encodeMemory(m);
    expect(text.startsWith(`${MEMORY_PREFIX} · `)).toBe(true);
    expect(decodeMemory(text)).toEqual(m);
  });

  it("keeps ciphertext and labels out of the human summary", () => {
    for (const m of samples) {
      const text = encodeMemory(m);
      const summary = text.slice(0, text.indexOf("⟦"));
      expect(summary).not.toContain(ENC.enc.ct);
      expect(summary).not.toContain(ENC.enc.iv);
      expect(summary).toBe(`${MEMORY_PREFIX} · ${summarize(m)} `);
    }
  });

  it("summaries are useful for semantic recall", () => {
    expect(summarize(wallet(ADDR_A))).toMatch(/^wallet · watching sui address 0xa1a1…a1a1$/);
    expect(summarize(fact(STAKE_KEY, "how"))).toBe("fact · how · staked SUI in sui wallet 0xa1a1…a1a1");
    expect(summarize(profile(30 * 86400))).toContain("30 days");
    expect(summarize(profile(180))).toContain("3 minutes (demo)");
  });

  it("rejects text without a token", () => {
    expect(decodeMemoryDetailed("Next of Kin · hello")).toEqual({ ok: false, reason: "no-token" });
    expect(decodeMemory("some other memory from another app")).toBeNull();
  });

  it("rejects a tampered payload (bad check)", () => {
    const text = encodeMemory(wallet(ADDR_A));
    const i = text.indexOf("nok:v1:") + 20;
    const flipped = text.slice(0, i) + (text[i] === "A" ? "B" : "A") + text.slice(i + 1);
    expect(decodeMemoryDetailed(flipped)).toEqual({ ok: false, reason: "bad-check" });
  });

  it("rejects a forged token whose payload fails the schema", () => {
    const m = wallet(ADDR_A) as unknown as Record<string, unknown>;
    expect(decodeMemoryDetailed(tokenFor(JSON.stringify({ ...m, kind: "nope" })))).toEqual({ ok: false, reason: "bad-schema" });
    expect(decodeMemoryDetailed(tokenFor(JSON.stringify({ ...m, extra: 1 })))).toEqual({ ok: false, reason: "bad-schema" });
    expect(decodeMemoryDetailed(tokenFor(JSON.stringify({ ...m, label: "plaintext label" })))).toEqual({ ok: false, reason: "bad-schema" });
  });

  it("rejects a token whose payload is not JSON", () => {
    expect(decodeMemoryDetailed(tokenFor("{not json"))).toEqual({ ok: false, reason: "bad-json" });
  });

  it("parseMemory validates request bodies", () => {
    expect(parseMemory(wallet(ADDR_A)).ok).toBe(true);
    const bad = parseMemory({ ...wallet(ADDR_A), id: "not-a-uuid" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/id/);
    expect(parseMemory({ ...fact(WA, "where"), baseline: { x: "-1" } }).ok).toBe(false);
  });

  it("encodeMemory refuses invalid memories", () => {
    expect(() => encodeMemory({ ...profile(), intervalSec: 1 })).toThrow();
  });
});
