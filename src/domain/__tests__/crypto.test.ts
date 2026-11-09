import { describe, expect, it } from "vitest";
import { createVault, decryptField, decryptFieldOrNull, deriveKey, encryptField, passphraseStrength, unlockVault } from "../crypto";
import { PBKDF2_ITERATIONS } from "../types";

const ITER = 1_000; // fast for tests; production default is 310,000

describe("crypto", () => {
  it("defaults to 310,000 PBKDF2 iterations", async () => {
    expect(PBKDF2_ITERATIONS).toBe(310_000);
  });

  it("round-trips a field and uses a fresh IV each time", async () => {
    const { key } = await createVault("correct horse battery staple", { iter: ITER });
    const a = await encryptField(key, "Ledger is in the fireproof box");
    const b = await encryptField(key, "Ledger is in the fireproof box");
    expect(a.enc.iv).not.toBe(b.enc.iv);
    expect(a.enc.ct).not.toBe(b.enc.ct);
    expect(await decryptField(key, a)).toBe("Ledger is in the fireproof box");
    expect(await decryptField(key, b)).toBe("Ledger is in the fireproof box");
  });

  it("handles unicode", async () => {
    const { key } = await createVault("pass phrase ✓", { iter: ITER });
    const enc = await encryptField(key, "Ọmọ mi — ₦ and 🏠");
    expect(await decryptField(key, enc)).toBe("Ọmọ mi — ₦ and 🏠");
  });

  it("unlocks with the right passphrase only", async () => {
    const { vault } = await createVault("the right one", { iter: ITER });
    expect(vault.iter).toBe(ITER);
    expect(await unlockVault(vault, "the right one")).not.toBeNull();
    expect(await unlockVault(vault, "the wrong one")).toBeNull();
  });

  it("a wrong key cannot decrypt", async () => {
    const { vault, key } = await createVault("owner passphrase", { iter: ITER });
    const enc = await encryptField(key, "secret note");
    const wrong = await deriveKey("not it", vault.salt, ITER);
    await expect(decryptField(wrong, enc)).rejects.toThrow();
    expect(await decryptFieldOrNull(wrong, enc)).toBeNull();
    expect(await decryptFieldOrNull(key, null)).toBeNull();
  });

  it("detects modified ciphertext", async () => {
    const { key } = await createVault("owner passphrase", { iter: ITER });
    const enc = await encryptField(key, "secret note");
    const ct = enc.enc.ct;
    const tampered = { enc: { ...enc.enc, ct: (ct[0] === "A" ? "B" : "A") + ct.slice(1) } };
    expect(await decryptFieldOrNull(key, tampered)).toBeNull();
  });

  it("rates passphrases", () => {
    expect(passphraseStrength("short").score).toBe(0);
    expect(passphraseStrength("onlylowercase").score).toBe(1);
    expect(passphraseStrength("river lamp quiet orange").score).toBe(3);
  });
});
