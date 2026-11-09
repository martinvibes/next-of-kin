import { assetKeys, walletIdOf } from "../ids";
import type {
  Asset,
  CheckinMemory,
  ConfirmMemory,
  Enc,
  FactField,
  FactMemory,
  LetterMemory,
  ProfileMemory,
  SnapshotMemory,
  WalletMemory,
} from "../types";

export const ENC: Enc = { enc: { iv: "AAAAAAAAAAAAAAAA", ct: "c2VjcmV0LWNpcGhlcnRleHQ" } };

let n = 0;
/** Deterministic, valid v4-shaped uuids for tests. */
export function uid(i?: number): string {
  const v = (i ?? ++n).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${v}`;
}

export const T0 = Date.parse("2026-11-01T00:00:00.000Z");
export function at(minutes: number): string {
  return new Date(T0 + minutes * 60_000).toISOString();
}

export const ADDR_A = "0x" + "a1".repeat(32);
export const ADDR_B = "0x" + "b2".repeat(32);
export const WA = walletIdOf("sui", ADDR_A);
export const WB = walletIdOf("sui", ADDR_B);
export const SUI_TYPE = "0x2::sui::SUI";
export const USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
export const POOL = "0x" + "c3".repeat(32);

export function wallet(address: string, ts = at(0), id = uid()): WalletMemory {
  return { v: 1, id, kind: "wallet", ts, walletId: walletIdOf("sui", address), chain: "sui", address, label: ENC };
}

export function fact(target: string, field: FactField, ts = at(1), baseline?: Record<string, string>, id = uid()): FactMemory {
  return { v: 1, id, kind: "fact", ts, target, field, value: ENC, ...(baseline ? { baseline } : {}) };
}

export function confirm(assetKey: string, amount: string, ts = at(5), id = uid()): ConfirmMemory {
  return { v: 1, id, kind: "confirm", ts, assetKey, amount, resolution: "accurate" };
}

export function profile(intervalSec = 180, ts = at(0), id = uid()): ProfileMemory {
  return { v: 1, id, kind: "profile", ts, ownerName: ENC, heirName: ENC, heirContact: ENC, intervalSec, graceSec: Math.round(intervalSec * 0.25) };
}

export function checkin(ts: string, id = uid()): CheckinMemory {
  return { v: 1, id, kind: "checkin", ts };
}

export function letter(ts = at(2), id = uid()): LetterMemory {
  return { v: 1, id, kind: "letter", ts, value: ENC };
}

export function snapshot(score: number, ts: string, id = uid()): SnapshotMemory {
  return { v: 1, id, kind: "snapshot", ts, score, coveredUsd: score, totalUsd: 100, assets: 2, covered: 1 };
}

export function suiCoin(address: string, amountRaw: string, usd: number | null, coinType = SUI_TYPE): Asset {
  const isSui = coinType === SUI_TYPE;
  const decimals = isSui ? 9 : 6;
  return {
    key: assetKeys.suiCoin(address, coinType),
    walletId: walletIdOf("sui", address),
    chain: "sui",
    address,
    kind: "coin",
    symbol: isSui ? "SUI" : "USDC",
    decimals,
    amountRaw,
    amount: Number(amountRaw) / 10 ** decimals,
    usd,
    liquid: true,
    meta: { coinType },
  };
}

export function stake(address: string, amountRaw: string, usd: number | null, poolId = POOL): Asset {
  return {
    key: assetKeys.suiStake(address, poolId),
    walletId: walletIdOf("sui", address),
    chain: "sui",
    address,
    kind: "stake",
    symbol: "SUI",
    decimals: 9,
    amountRaw,
    amount: Number(amountRaw) / 1e9,
    usd,
    liquid: false,
    meta: { poolId, validatorName: "Mysten Labs 1" },
  };
}
