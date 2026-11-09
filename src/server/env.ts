import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";

/**
 * Environment, read lazily on every call so scripts can load .env files before
 * first use and tests can flip variables. Nothing here is ever sent to the
 * browser.
 */

export type MemoryMode = "mainnet" | "mock";
export type ChainMode = "live" | "fixtures" | "unavailable";

export const DEFAULT_NAMESPACE = "next-of-kin";
export const DEFAULT_RELAYER = "https://relayer.memory.walrus.xyz";

export interface NokEnv {
  tatumApiKey: string | null;
  memwal: { accountId: string; privateKey: string } | null;
  namespace: string;
  serverUrl: string;
  ownerSecret: string | null;
  suiAddresses: string[];
  invalidSuiAddresses: string[];
  ethAddress: string | null;
  /** NOK_FIXTURES=1 and allowed in this environment */
  fixtures: boolean;
  /** NOK_FIXTURES_DRIFT=1 (only meaningful with fixtures) */
  fixturesDrift: boolean;
  /** NOK_FIXTURES=1 was set but refused because this is a production deployment */
  fixturesRefused: boolean;
  isProductionDeployment: boolean;
}

/** Empty strings and obvious placeholders count as unset. */
function read(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const v = raw.trim();
  if (v === "" || /^<.*>$/.test(v) || /^(changeme|todo|xxx+)$/i.test(v)) return null;
  return v;
}

function flag(name: string): boolean {
  const v = read(name);
  return v === "1" || v === "true" || v === "yes";
}

let warnedFixturesRefused = false;

export function getEnv(): NokEnv {
  const isProductionDeployment = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
  const wantsFixtures = flag("NOK_FIXTURES");
  const fixturesRefused = wantsFixtures && isProductionDeployment;
  if (fixturesRefused && !warnedFixturesRefused) {
    warnedFixturesRefused = true;
    console.warn("[nok] NOK_FIXTURES=1 ignored: fixture chain data is never used in a production deployment.");
  }

  const accountId = read("MEMWAL_ACCOUNT_ID");
  const privateKey = read("MEMWAL_PRIVATE_KEY");

  const suiAddresses: string[] = [];
  const invalidSuiAddresses: string[] = [];
  for (const part of (read("NOK_SUI_ADDRESSES") ?? "").split(/[\s,]+/)) {
    if (!part) continue;
    if (isValidSuiAddress(normalizeSuiAddress(part)) && /^0x[0-9a-fA-F]{1,64}$/.test(part)) {
      const norm = normalizeSuiAddress(part);
      if (!suiAddresses.includes(norm)) suiAddresses.push(norm);
    } else invalidSuiAddresses.push(part);
  }
  const eth = read("NOK_ETH_ADDRESS");

  return {
    tatumApiKey: read("TATUM_API_KEY"),
    memwal: accountId && privateKey ? { accountId, privateKey } : null,
    namespace: read("MEMWAL_NAMESPACE") ?? DEFAULT_NAMESPACE,
    serverUrl: (read("MEMWAL_SERVER_URL") ?? DEFAULT_RELAYER).replace(/\/+$/, ""),
    ownerSecret: read("OWNER_SECRET"),
    suiAddresses,
    invalidSuiAddresses,
    ethAddress: eth && /^0x[0-9a-fA-F]{40}$/.test(eth) ? eth.toLowerCase() : null,
    fixtures: wantsFixtures && !isProductionDeployment,
    fixturesDrift: flag("NOK_FIXTURES_DRIFT"),
    fixturesRefused,
    isProductionDeployment,
  };
}

/** Walrus Memory runs on Mainnet when credentials exist, otherwise the SDK's in-memory mock. */
export function memoryMode(env: NokEnv = getEnv()): MemoryMode {
  return env.memwal ? "mainnet" : "mock";
}

/**
 * Chain data source:
 *  - fixtures: NOK_FIXTURES=1 (dev only), or no Tatum key outside production
 *  - live: Tatum key present
 *  - unavailable: production without a Tatum key
 */
export function chainMode(env: NokEnv = getEnv()): ChainMode {
  if (env.fixtures) return "fixtures";
  if (env.tatumApiKey) return "live";
  if (process.env.NODE_ENV !== "production") return "fixtures";
  return "unavailable";
}

export function ownerSecretConfigured(env: NokEnv = getEnv()): boolean {
  return env.ownerSecret !== null;
}

function digest(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/** Constant-time comparison of the x-owner-secret header against OWNER_SECRET. */
export function isOwner(input: Request | Headers | string | null | undefined): boolean {
  const secret = getEnv().ownerSecret;
  if (!secret) return false;
  const provided =
    typeof input === "string" ? input : input instanceof Headers ? input.get("x-owner-secret") : input?.headers.get("x-owner-secret");
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(secret));
}

/** Standard 401 for owner-only routes. */
export function ownerUnauthorized(): Response {
  const configured = ownerSecretConfigured();
  return Response.json(
    {
      error: configured
        ? "Owner secret missing or wrong. Enter it on the setup page to unlock changes."
        : "OWNER_SECRET is not set on the server, so owner changes are disabled.",
    },
    { status: configured ? 401 : 503 },
  );
}
