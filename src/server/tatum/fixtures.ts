import "server-only";
import type { Chain } from "@/domain/types";

/**
 * Deterministic FIXTURE chain data for local UI work and tests. Never used in
 * a production deployment (see env.ts). The UI must show a
 * "FIXTURE CHAIN DATA" banner whenever this provider is active.
 *
 * Positions are assigned by a wallet's position among the scanned Sui wallets:
 *   1st Sui wallet  → "A": liquid SUI + SUI staked with one validator
 *   2nd Sui wallet  → "B": USDC + a little SUI
 *   others          → a small amount of liquid SUI
 * Ethereum wallets → a little native ETH.
 *
 * NOK_FIXTURES_DRIFT=1 drops wallet A's liquid SUI by 80% so drift can be shown.
 */

export const FIXTURE_USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
export const FIXTURE_SUI_TYPE = "0x2::sui::SUI";
/** 0x + 64 hex; obviously not a real pool */
export const FIXTURE_POOL_ID = `0x${"0".repeat(56)}f1c70e01`;
export const FIXTURE_VALIDATOR = "Fixture Validator (not real)";
export const FIXTURE_LAST_TX = "2026-11-01T12:00:00.000Z";

export const FIXTURE_PRICES: Record<string, number> = { SUI: 3.42, ETH: 3150, USDC: 1 };

export interface FixtureCoin {
  coinType: string;
  symbol: string;
  decimals: number;
  balance: string;
}

export interface FixtureStake {
  poolId: string;
  validatorName: string;
  principalRaw: string;
}

export interface FixtureWallet {
  coins: FixtureCoin[];
  stakes: FixtureStake[];
  lastOutgoingTx: string | null;
}

const SUI = (n: number) => BigInt(Math.round(n * 1e9)).toString();
const USDC = (n: number) => BigInt(Math.round(n * 1e6)).toString();

export function fixtureWallet(chain: Chain, suiIndex: number, opts: { drift: boolean }): FixtureWallet {
  if (chain === "ethereum") {
    return { coins: [{ coinType: "native", symbol: "ETH", decimals: 18, balance: (BigInt(12) * BigInt(10) ** BigInt(15)).toString() }], stakes: [], lastOutgoingTx: null };
  }
  if (suiIndex === 0) {
    return {
      coins: [{ coinType: FIXTURE_SUI_TYPE, symbol: "SUI", decimals: 9, balance: SUI(opts.drift ? 1.6 : 8) }],
      stakes: [{ poolId: FIXTURE_POOL_ID, validatorName: FIXTURE_VALIDATOR, principalRaw: SUI(5) }],
      lastOutgoingTx: FIXTURE_LAST_TX,
    };
  }
  if (suiIndex === 1) {
    return {
      coins: [
        { coinType: FIXTURE_USDC_TYPE, symbol: "USDC", decimals: 6, balance: USDC(12.5) },
        { coinType: FIXTURE_SUI_TYPE, symbol: "SUI", decimals: 9, balance: SUI(0.4) },
      ],
      stakes: [],
      lastOutgoingTx: FIXTURE_LAST_TX,
    };
  }
  return { coins: [{ coinType: FIXTURE_SUI_TYPE, symbol: "SUI", decimals: 9, balance: SUI(0.75) }], stakes: [], lastOutgoingTx: null };
}
