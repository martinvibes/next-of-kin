import type { Chain } from "./types";

/** Wallet id is deterministic so asset keys and facts line up across rebuilds. */
export function walletIdOf(chain: Chain, address: string): string {
  return `${chain}:${address.toLowerCase()}`;
}

export function parseWalletId(walletId: string): { chain: Chain; address: string } | null {
  const i = walletId.indexOf(":");
  if (i < 0) return null;
  const chain = walletId.slice(0, i);
  if (chain !== "sui" && chain !== "ethereum") return null;
  return { chain, address: walletId.slice(i + 1) };
}

export const assetKeys = {
  suiCoin: (address: string, coinType: string) => `sui:${address.toLowerCase()}:coin:${coinType}`,
  suiStake: (address: string, poolId: string) => `sui:${address.toLowerCase()}:stake:${poolId}`,
  ethNative: (address: string) => `ethereum:${address.toLowerCase()}:native`,
};

/** The walletId an asset key belongs to (first two segments). */
export function walletIdOfAssetKey(assetKey: string): string {
  const parts = assetKey.split(":");
  return `${parts[0]}:${parts[1]}`;
}

export function isAssetKey(target: string): boolean {
  return target.split(":").length > 2;
}

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}
