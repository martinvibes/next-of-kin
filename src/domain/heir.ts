/**
 * Heir recovery guide — built in the browser from decrypted memories plus
 * live balances. Pure and deterministic.
 */
import { formatAmount } from "./format";
import { isAssetKey, shortAddress } from "./ids";
import type { Asset, Chain, FactField } from "./types";

export interface DecryptedWallet {
  walletId: string;
  chain: Chain;
  address: string;
  label: string;
}

export interface DecryptedFact {
  target: string;
  field: FactField;
  value: string;
}

export interface GuideAsset {
  asset: Asset;
  how?: string;
  who?: string;
  steps: string[];
}

export interface GuideWallet {
  walletId: string;
  chain: Chain;
  address: string;
  label: string;
  where?: string;
  how?: string;
  who?: string;
  assets: GuideAsset[];
}

function chainName(chain: Chain): string {
  return chain === "sui" ? "Sui" : "Ethereum";
}

export function buildRecoverySteps(asset: Asset, opts: { walletLabel?: string } = {}): string[] {
  const wallet = opts.walletLabel ? `‘${opts.walletLabel}’` : `the ${chainName(asset.chain)} wallet ${shortAddress(asset.address)}`;
  const amount = formatAmount(asset.amount, asset.symbol);
  if (asset.kind === "stake") {
    const validator = asset.meta.validatorName ?? (asset.meta.poolId ? `pool ${shortAddress(asset.meta.poolId)}` : "the validator");
    return [
      `Open ${wallet} using the “where” and “how” notes above.`,
      `Go to Staking and find the stake with ${validator}.`,
      `Withdraw the ${amount}. It becomes spendable at the start of the next epoch (about 24 hours).`,
      "When it shows as liquid SUI, send it to an address you control — a small test amount first.",
    ];
  }
  if (asset.chain === "ethereum") {
    return [
      `Open ${wallet} using the notes above.`,
      `Check the balance shows about ${amount}.`,
      "Send it to an address you control. Send a small test amount first and leave a little ETH to pay the network fee.",
    ];
  }
  const steps = [`Open ${wallet} using the notes above.`, `Check the balance shows about ${amount}.`];
  if (asset.symbol !== "SUI") steps.push("Keep a little SUI in the wallet — it pays the network fee for sending.");
  steps.push("Send it to an address you control. Send a small test amount first.");
  return steps;
}

/** Group decrypted facts and live assets into one guide section per wallet. */
export function buildGuide(input: { wallets: DecryptedWallet[]; facts: DecryptedFact[]; assets: Asset[] }): GuideWallet[] {
  const factFor = (target: string, field: FactField) =>
    input.facts.filter((f) => f.target === target && f.field === field).at(-1)?.value;

  return input.wallets.map((w) => {
    const assets = input.assets
      .filter((a) => a.walletId === w.walletId)
      .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || (a.key < b.key ? -1 : 1))
      .map<GuideAsset>((asset) => ({
        asset,
        how: factFor(asset.key, "how"),
        who: factFor(asset.key, "who"),
        steps: buildRecoverySteps(asset, { walletLabel: w.label }),
      }));
    return {
      walletId: w.walletId,
      chain: w.chain,
      address: w.address,
      label: w.label,
      where: factFor(w.walletId, "where"),
      how: factFor(w.walletId, "how"),
      who: factFor(w.walletId, "who"),
      assets,
    };
  });
}

/** Facts that target an asset no longer on chain (so the guide can mention them). */
export function orphanedAssetFacts(facts: DecryptedFact[], assets: Asset[]): DecryptedFact[] {
  const keys = new Set(assets.map((a) => a.key));
  return facts.filter((f) => isAssetKey(f.target) && !keys.has(f.target));
}
