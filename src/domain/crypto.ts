/**
 * Browser-side field encryption (isomorphic: browser + Node 20+ via globalThis.crypto).
 *
 * Vault passphrase → PBKDF2-SHA256 (310,000 iterations) → AES-GCM-256 key.
 * Every field gets a fresh 12-byte random IV. The key is non-extractable and
 * lives only in memory for the session.
 */
import { b64urlToBytes, bytesToB64url } from "./b64";
import { PBKDF2_ITERATIONS, VAULT_CHECK_PLAINTEXT, type Enc, type VaultMemory } from "./types";

export type VaultFields = Pick<VaultMemory, "salt" | "iter" | "check">;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto is not available in this environment");
  return s;
}

function normalizePassphrase(passphrase: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(passphrase.normalize("NFKC"));
}

export async function deriveKey(passphrase: string, saltB64url: string, iter: number = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", normalizePassphrase(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: b64urlToBytes(saltB64url), iterations: iter },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptRaw(key: CryptoKey, plaintext: string): Promise<{ iv: string; ct: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { iv: bytesToB64url(iv), ct: bytesToB64url(new Uint8Array(ct)) };
}

async function decryptRaw(key: CryptoKey, blob: { iv: string; ct: string }): Promise<string> {
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: b64urlToBytes(blob.iv) }, key, b64urlToBytes(blob.ct));
  return new TextDecoder("utf-8", { fatal: true }).decode(pt);
}

export async function encryptField(key: CryptoKey, plaintext: string): Promise<Enc> {
  return { enc: await encryptRaw(key, plaintext) };
}

/** Throws if the key is wrong or the ciphertext was modified. */
export async function decryptField(key: CryptoKey, field: Enc): Promise<string> {
  return decryptRaw(key, field.enc);
}

/** Like decryptField but returns null instead of throwing. */
export async function decryptFieldOrNull(key: CryptoKey, field: Enc | undefined | null): Promise<string | null> {
  if (!field) return null;
  try {
    return await decryptRaw(key, field.enc);
  } catch {
    return null;
  }
}

export async function createVault(passphrase: string, opts: { iter?: number } = {}): Promise<{ vault: VaultFields; key: CryptoKey }> {
  const iter = opts.iter ?? PBKDF2_ITERATIONS;
  const salt = bytesToB64url(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(passphrase, salt, iter);
  const check = await encryptRaw(key, VAULT_CHECK_PLAINTEXT);
  return { vault: { salt, iter, check }, key };
}

/** Returns the session key, or null when the passphrase is wrong. */
export async function unlockVault(vault: VaultFields, passphrase: string): Promise<CryptoKey | null> {
  try {
    const key = await deriveKey(passphrase, vault.salt, vault.iter);
    const check = await decryptRaw(key, vault.check);
    return check === VAULT_CHECK_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

/** A rough, honest passphrase strength hint for the setup screen. */
export function passphraseStrength(passphrase: string): { score: 0 | 1 | 2 | 3; label: string } {
  const p = passphrase.trim();
  const words = p.split(/\s+/).filter(Boolean).length;
  let classes = 0;
  if (/[a-z]/.test(p)) classes++;
  if (/[A-Z]/.test(p)) classes++;
  if (/\d/.test(p)) classes++;
  if (/[^A-Za-z0-9\s]/.test(p)) classes++;
  if (p.length < 10) return { score: 0, label: "Too short — use at least 10 characters" };
  if (p.length >= 20 || (words >= 4 && p.length >= 16)) return { score: 3, label: "Strong" };
  if (p.length >= 14 || classes >= 3) return { score: 2, label: "Good — longer is better" };
  return { score: 1, label: "Weak — add a few more words" };
}
