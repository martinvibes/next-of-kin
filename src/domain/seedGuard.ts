/**
 * Seed-phrase / private-key guard. Runs in the browser before encryption and
 * on the server on every plaintext field. Next of Kin never stores keys.
 *
 * Blocks:
 *  - bip39:      a run of 12 consecutive words where ≥10 are BIP39 English words
 *                (numbers and punctuation between words are ignored, so
 *                "1. abandon 2. ability …" is caught). Ordinary prose rarely
 *                trips this because BIP39 has no short function words
 *                ("the", "my", "in", "is", "and" …).
 *  - suiprivkey: anything containing `suiprivkey1`
 *  - xprv:       extended private keys (xprv/tprv + base58 body)
 *  - pem:        `-----BEGIN` blocks
 *  - hex64:      a bare run of ≥64 hex chars not prefixed by 0x
 * Allows 0x-prefixed 40/64-hex (EVM and Sui addresses, object ids).
 */
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const SECRET_MESSAGE =
  "That looks like a recovery phrase or private key. Next of Kin never stores keys — write down WHERE it is instead.";

export type SecretReason = "bip39" | "suiprivkey" | "xprv" | "pem" | "hex64";

export interface SecretCheck {
  blocked: boolean;
  reason?: SecretReason;
}

const BIP39 = new Set(wordlist);
const WINDOW = 12;
const MIN_HITS = 10;

function hasBip39Run(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length < WINDOW) return false;
  let hits = 0;
  for (let i = 0; i < words.length; i++) {
    if (BIP39.has(words[i]!)) hits++;
    if (i >= WINDOW && BIP39.has(words[i - WINDOW]!)) hits--;
    if (i >= WINDOW - 1 && hits >= MIN_HITS) return true;
  }
  return false;
}

function hasBareHex(text: string): boolean {
  const re = /[0-9a-fA-F]{64,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 2), m.index);
    if (before.toLowerCase() !== "0x") return true;
  }
  return false;
}

export function detectSecret(text: string): SecretCheck {
  if (!text) return { blocked: false };
  if (/suiprivkey1/i.test(text)) return { blocked: true, reason: "suiprivkey" };
  if (/-----BEGIN/.test(text)) return { blocked: true, reason: "pem" };
  if (/\b[xt]prv[1-9A-HJ-NP-Za-km-z]{8,}/.test(text)) return { blocked: true, reason: "xprv" };
  if (hasBareHex(text)) return { blocked: true, reason: "hex64" };
  if (hasBip39Run(text)) return { blocked: true, reason: "bip39" };
  return { blocked: false };
}

/** Convenience: true when any of the given strings looks like a secret. */
export function anySecret(...texts: Array<string | null | undefined>): SecretCheck {
  for (const t of texts) {
    if (!t) continue;
    const r = detectSecret(t);
    if (r.blocked) return r;
  }
  return { blocked: false };
}
