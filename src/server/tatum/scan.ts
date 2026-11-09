import "server-only";
import { assetKeys, shortAddress } from "@/domain/ids";
import type { Asset, Chain, ScanResult, WalletScan } from "@/domain/types";
import { chainMode, getEnv } from "../env";
import { ethBalanceWei } from "./eth";
import { FIXTURE_LAST_TX, FIXTURE_PRICES, fixtureWallet } from "./fixtures";
import { isStablecoin, priceUsd, type Price } from "./prices";
import { TatumError, tatumCallCount } from "./queue";
import { coinMetadata, lastOutgoingTx, listAllBalances, normalizeCoinType, normalizeId, stakedSui, validatorNames } from "./sui";

export interface WalletRef {
  walletId: string;
  chain: Chain;
  address: string;
}

/** Symbols we ask Tatum to price; anything else shows "no price" rather than burning calls. */
const PRICED = new Set(["SUI", "ETH", "WETH", "WAL", "DEEP", "BTC", "WBTC", "NS", "CETUS"]);

function toAmount(raw: string, decimals: number): number {
  const v = BigInt(raw);
  const base = BigInt(10) ** BigInt(decimals);
  return Number(v / base) + Number(v % base) / Number(base);
}

function symbolFromType(coinType: string): string {
  return coinType.split("::").pop() ?? "COIN";
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Live (Tatum) ───────────────────────────────────────────────────────────

async function scanSuiLive(w: WalletRef): Promise<WalletScan> {
  const assets: Asset[] = [];
  const errors: string[] = [];
  let lastTx: string | null = null;

  try {
    const balances = await listAllBalances(w.address);
    for (const b of balances) {
      if (BigInt(b.balance) === BigInt(0)) continue;
      const coinType = normalizeCoinType(b.coinType);
      let meta = null;
      try {
        meta = await coinMetadata(coinType);
      } catch (err) {
        errors.push(`metadata for ${symbolFromType(coinType)}: ${errMsg(err)}`);
      }
      const decimals = meta?.decimals ?? 0;
      assets.push({
        key: assetKeys.suiCoin(w.address, coinType),
        walletId: w.walletId,
        chain: "sui",
        address: w.address,
        kind: "coin",
        symbol: meta?.symbol ?? symbolFromType(coinType),
        decimals,
        amountRaw: b.balance,
        amount: toAmount(b.balance, decimals),
        usd: null,
        liquid: true,
        meta: { coinType, ...(meta?.iconUrl ? { iconUrl: meta.iconUrl } : {}) },
      });
    }
  } catch (err) {
    errors.push(`balances: ${errMsg(err)}`);
  }

  try {
    const stakes = await stakedSui(w.address);
    if (stakes.length) {
      const byPool = new Map<string, bigint>();
      for (const s of stakes) {
        const pool = normalizeId(s.poolId);
        byPool.set(pool, (byPool.get(pool) ?? BigInt(0)) + BigInt(s.principalRaw));
      }
      const names = await validatorNames();
      for (const [poolId, principal] of byPool) {
        const raw = principal.toString();
        assets.push({
          key: assetKeys.suiStake(w.address, poolId),
          walletId: w.walletId,
          chain: "sui",
          address: w.address,
          kind: "stake",
          symbol: "SUI",
          decimals: 9,
          amountRaw: raw,
          amount: toAmount(raw, 9),
          usd: null,
          liquid: false,
          meta: { poolId, validatorName: names.get(poolId) ?? `validator ${shortAddress(poolId)}` },
        });
      }
    }
  } catch (err) {
    errors.push(`staked SUI: ${errMsg(err)}`);
  }

  try {
    lastTx = await lastOutgoingTx(w.address);
  } catch (err) {
    errors.push(`last transaction: ${errMsg(err)}`);
  }

  return { walletId: w.walletId, chain: "sui", address: w.address, assets, lastOutgoingTx: lastTx, ...(errors.length ? { error: errors.join("; ") } : {}) };
}

async function scanEthLive(w: WalletRef): Promise<WalletScan> {
  try {
    const wei = await ethBalanceWei(w.address);
    const assets: Asset[] =
      BigInt(wei) === BigInt(0)
        ? []
        : [
            {
              key: assetKeys.ethNative(w.address),
              walletId: w.walletId,
              chain: "ethereum",
              address: w.address,
              kind: "native",
              symbol: "ETH",
              decimals: 18,
              amountRaw: wei,
              amount: toAmount(wei, 18),
              usd: null,
              liquid: true,
              meta: {},
            },
          ];
    return { walletId: w.walletId, chain: "ethereum", address: w.address, assets, lastOutgoingTx: null };
  } catch (err) {
    return { walletId: w.walletId, chain: "ethereum", address: w.address, assets: [], lastOutgoingTx: null, error: `balance: ${errMsg(err)}` };
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function scanFixtures(wallets: WalletRef[], drift: boolean): WalletScan[] {
  let suiIndex = 0;
  return wallets.map((w) => {
    const fx = fixtureWallet(w.chain, w.chain === "sui" ? suiIndex++ : 0, { drift });
    const assets: Asset[] = [];
    for (const c of fx.coins) {
      assets.push({
        key: w.chain === "ethereum" ? assetKeys.ethNative(w.address) : assetKeys.suiCoin(w.address, c.coinType),
        walletId: w.walletId,
        chain: w.chain,
        address: w.address,
        kind: w.chain === "ethereum" ? "native" : "coin",
        symbol: c.symbol,
        decimals: c.decimals,
        amountRaw: c.balance,
        amount: toAmount(c.balance, c.decimals),
        usd: null,
        liquid: true,
        meta: w.chain === "sui" ? { coinType: c.coinType } : {},
      });
    }
    for (const s of fx.stakes) {
      assets.push({
        key: assetKeys.suiStake(w.address, s.poolId),
        walletId: w.walletId,
        chain: "sui",
        address: w.address,
        kind: "stake",
        symbol: "SUI",
        decimals: 9,
        amountRaw: s.principalRaw,
        amount: toAmount(s.principalRaw, 9),
        usd: null,
        liquid: false,
        meta: { poolId: s.poolId, validatorName: s.validatorName },
      });
    }
    return { walletId: w.walletId, chain: w.chain, address: w.address, assets, lastOutgoingTx: fx.lastOutgoingTx };
  });
}

// ─── Pricing ────────────────────────────────────────────────────────────────

async function priceAll(assets: Asset[], fixtures: boolean): Promise<ScanResult["prices"]> {
  const symbols = [...new Set(assets.map((a) => a.symbol.toUpperCase()))];
  const prices: ScanResult["prices"] = {};
  for (const sym of symbols) {
    let p: Price | null = null;
    if (fixtures) {
      const usd = FIXTURE_PRICES[sym] ?? (isStablecoin(sym) ? 1 : undefined);
      if (usd !== undefined) p = { usd, source: "fixture", at: new Date().toISOString() };
    } else if (PRICED.has(sym) || isStablecoin(sym)) {
      p = await priceUsd(sym);
    }
    if (p) prices[sym] = p;
  }
  for (const a of assets) {
    const p = prices[a.symbol.toUpperCase()];
    a.usd = p ? Math.round(a.amount * p.usd * 100) / 100 : null;
  }
  return prices;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Scan wallets via Tatum (or fixtures). Never throws for one bad wallet:
 * per-wallet failures land in WalletScan.error, and a wallet with an error may
 * be INCOMPLETE — do not compute drift on it (a failed stake query would
 * otherwise look like a "missing" asset).
 *
 * Throws TatumError only when chain data is unavailable altogether
 * (production without TATUM_API_KEY).
 */
export async function scanWallets(wallets: WalletRef[]): Promise<ScanResult> {
  const mode = chainMode();
  if (mode === "unavailable") throw new TatumError("Chain data unavailable: TATUM_API_KEY is not set on the server.", "scan", null);
  const before = tatumCallCount();
  const scannedAt = new Date().toISOString();

  let scans: WalletScan[];
  if (mode === "fixtures") {
    scans = scanFixtures(wallets, getEnv().fixturesDrift);
  } else {
    scans = [];
    // sequential: the queue throttles anyway, and this keeps per-wallet errors isolated
    for (const w of wallets) scans.push(w.chain === "sui" ? await scanSuiLive(w) : await scanEthLive(w));
  }

  const assets = scans.flatMap((s) => s.assets);
  const prices = await priceAll(assets, mode === "fixtures");

  return {
    scannedAt,
    wallets: scans,
    assets,
    prices,
    tatumCalls: tatumCallCount() - before,
    mode: mode === "fixtures" ? "fixtures" : "live",
  };
}

export interface OnchainLiveness {
  /** latest outgoing tx across the given Sui addresses */
  lastOnchain: string | null;
  /** false when no lookup succeeded (switch then uses check-ins only) */
  available: boolean;
  source: "tatum" | "fixtures" | "none";
}

/** On-chain proof of life: the newest transaction the owner sent from any watched Sui wallet. */
export async function onchainLiveness(suiAddresses: string[]): Promise<OnchainLiveness> {
  const mode = chainMode();
  if (mode === "unavailable" || suiAddresses.length === 0) return { lastOnchain: null, available: false, source: "none" };
  if (mode === "fixtures") return { lastOnchain: FIXTURE_LAST_TX, available: true, source: "fixtures" };
  let latest: string | null = null;
  let ok = 0;
  for (const address of suiAddresses) {
    try {
      const ts = await lastOutgoingTx(address);
      ok++;
      if (ts && (!latest || ts > latest)) latest = ts;
    } catch (err) {
      console.warn(`[nok] liveness lookup failed for ${shortAddress(address)}:`, errMsg(err));
    }
  }
  return { lastOnchain: latest, available: ok > 0, source: "tatum" };
}
