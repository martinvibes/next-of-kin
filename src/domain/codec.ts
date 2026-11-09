/**
 * Memory codec: every Next of Kin memory is one Walrus Memory text.
 *
 *   Next of Kin · <non-sensitive summary> ⟦nok:v1:<base64url(JSON)>.<check>⟧
 *
 * The summary helps semantic recall and keeps memories readable in tools; it
 * never contains secrets. The payload carries the typed memory; sensitive
 * fields inside it are already AES-GCM ciphertext. <check> is a truncated
 * SHA-256 of the payload so edits to the payload are detected and dropped.
 */
import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { b64urlToUtf8, bytesToB64url, utf8ToB64url } from "./b64";
import { isAssetKey, parseWalletId, shortAddress, walletIdOfAssetKey } from "./ids";
import type { NokMemory } from "./types";

export const MEMORY_PREFIX = "Next of Kin";
const TOKEN_RE = /⟦nok:v1:([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{12})⟧/;

// ─── Schema ─────────────────────────────────────────────────────────────────

const b64 = z.string().regex(/^[A-Za-z0-9_-]+$/).max(200_000);
const encBlob = z.object({ iv: b64.max(32), ct: b64 }).strict();
const enc = z.object({ enc: encBlob }).strict();
const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid timestamp");
const rawAmount = z.string().regex(/^\d{1,78}$/);
const chain = z.enum(["sui", "ethereum"]);
const key = z.string().min(3).max(400);

const base = {
  v: z.literal(1),
  id: z.string().uuid(),
  ts: iso,
};

export const memorySchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("vault"), salt: b64.max(64), iter: z.number().int().min(100_000).max(5_000_000), check: encBlob }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("profile"),
      ownerName: enc,
      heirName: enc,
      heirContact: enc,
      intervalSec: z.number().int().min(60).max(5 * 365 * 86400),
      graceSec: z.number().int().min(0).max(5 * 365 * 86400),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("wallet"), walletId: key, chain, address: z.string().min(3).max(100), label: enc }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("fact"),
      target: key,
      field: z.enum(["where", "how", "who"]),
      value: enc,
      baseline: z.record(key, rawAmount).optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("confirm"),
      assetKey: key,
      amount: rawAmount,
      resolution: z.enum(["accurate", "moved", "spent"]),
      note: enc.optional(),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("letter"), value: enc }).strict(),
  z.object({ ...base, kind: z.literal("checkin") }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("snapshot"),
      score: z.number().min(0).max(100),
      coveredUsd: z.number().min(0),
      totalUsd: z.number().min(0),
      assets: z.number().int().min(0),
      covered: z.number().int().min(0),
      cause: z.string().max(140).optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("release"),
      reason: z.string().max(280),
      lastCheckin: iso.nullable(),
      lastOnchain: iso.nullable(),
      verifiedVia: z.literal("tatum"),
    })
    .strict(),
]);

// ─── Summary (non-sensitive) ────────────────────────────────────────────────

function walletPhrase(walletId: string): string {
  const w = parseWalletId(walletId);
  return w ? `${w.chain} wallet ${shortAddress(w.address)}` : "wallet";
}

function assetPhrase(assetKey: string): string {
  const parts = assetKey.split(":");
  const kind = parts[2];
  const wallet = walletPhrase(walletIdOfAssetKey(assetKey));
  if (kind === "stake") return `staked SUI in ${wallet}`;
  if (kind === "native") return `native ETH in ${wallet}`;
  const coinType = parts.slice(3).join(":");
  const symbol = coinType.split("::").pop() ?? "coin";
  return `${symbol} in ${wallet}`;
}

function humanInterval(sec: number): string {
  if (sec < 3600) return `${Math.round(sec / 60)} minutes (demo)`;
  if (sec < 86400) return `${Math.round(sec / 3600)} hours`;
  return `${Math.round(sec / 86400)} days`;
}

export function summarize(m: NokMemory): string {
  switch (m.kind) {
    case "vault":
      return "vault · encrypted passphrase check created";
    case "profile":
      return `profile · owner check-in every ${humanInterval(m.intervalSec)}`;
    case "wallet":
      return `wallet · watching ${m.chain} address ${shortAddress(m.address)}`;
    case "fact":
      return `fact · ${m.field} · ${isAssetKey(m.target) ? assetPhrase(m.target) : walletPhrase(m.target)}`;
    case "confirm":
      return `confirm · ${assetPhrase(m.assetKey)} · ${m.resolution === "accurate" ? "still accurate" : m.resolution === "moved" ? "owner moved it" : "spent or sold"}`;
    case "letter":
      return "letter · encrypted message to the heir";
    case "checkin":
      return "checkin · owner proof of life";
    case "snapshot":
      return `snapshot · heir readiness ${Math.round(m.score)}%${m.cause ? ` · ${m.cause}` : ""}`;
    case "release":
      return "release · heir recovery guide released";
  }
}

// ─── Encode / decode ────────────────────────────────────────────────────────

function check(payload: string): string {
  return bytesToB64url(sha256(new TextEncoder().encode(payload))).slice(0, 12);
}

export function encodeMemory(m: NokMemory): string {
  const parsed = memorySchema.parse(m);
  const payload = utf8ToB64url(JSON.stringify(parsed));
  return `${MEMORY_PREFIX} · ${summarize(parsed as NokMemory)} ⟦nok:v1:${payload}.${check(payload)}⟧`;
}

export type DecodeResult = { ok: true; memory: NokMemory } | { ok: false; reason: "no-token" | "bad-check" | "bad-json" | "bad-schema" };

export function decodeMemoryDetailed(text: string): DecodeResult {
  const match = TOKEN_RE.exec(text);
  if (!match) return { ok: false, reason: "no-token" };
  const [, payload, sum] = match as unknown as [string, string, string];
  if (check(payload) !== sum) return { ok: false, reason: "bad-check" };
  let json: unknown;
  try {
    json = JSON.parse(b64urlToUtf8(payload));
  } catch {
    return { ok: false, reason: "bad-json" };
  }
  const parsed = memorySchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "bad-schema" };
  return { ok: true, memory: parsed.data as NokMemory };
}

/** Strict decoder: malformed or tampered memories return null. */
export function decodeMemory(text: string): NokMemory | null {
  const r = decodeMemoryDetailed(text);
  return r.ok ? r.memory : null;
}

/** Validate an object (e.g. an API request body) as a memory. */
export function parseMemory(input: unknown): { ok: true; memory: NokMemory } | { ok: false; error: string } {
  const r = memorySchema.safeParse(input);
  if (r.success) return { ok: true, memory: r.data as NokMemory };
  return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "memory"}: ${i.message}`).join("; ") };
}
