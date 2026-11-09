/**
 * Shared domain contract for Next of Kin.
 *
 * Every piece of state is a memory stored on Walrus Memory. The app keeps no
 * database: state is a deterministic fold over these memories.
 */

export type Chain = "sui" | "ethereum";

/** An encrypted field. AES-GCM-256, base64url iv (12 bytes) + ciphertext. */
export interface Enc {
  enc: { iv: string; ct: string };
}

export type MemoryKind =
  | "vault"
  | "profile"
  | "wallet"
  | "fact"
  | "confirm"
  | "letter"
  | "checkin"
  | "snapshot"
  | "release";

interface MemoryBase {
  v: 1;
  /** uuid v4, also used as the Walrus Memory idempotency key */
  id: string;
  kind: MemoryKind;
  /** ISO-8601 timestamp */
  ts: string;
}

export interface VaultMemory extends MemoryBase {
  kind: "vault";
  /** base64url PBKDF2 salt */
  salt: string;
  iter: number;
  /** encryption of the constant VAULT_CHECK_PLAINTEXT, used to verify a passphrase */
  check: { iv: string; ct: string };
}

export interface ProfileMemory extends MemoryBase {
  kind: "profile";
  ownerName: Enc;
  heirName: Enc;
  heirContact: Enc;
  /** check-in interval, plaintext because the server runs the switch */
  intervalSec: number;
  graceSec: number;
}

export interface WalletMemory extends MemoryBase {
  kind: "wallet";
  /** `${chain}:${address.toLowerCase()}` — see walletIdOf() */
  walletId: string;
  chain: Chain;
  address: string;
  label: Enc;
}

export type FactField = "where" | "how" | "who";

export interface FactMemory extends MemoryBase {
  kind: "fact";
  /** a walletId (wallet-level fact) or an assetKey (asset-level fact) */
  target: string;
  field: FactField;
  value: Enc;
  /** raw amounts at answer time; wallet-level: every asset in the wallet, asset-level: that asset */
  baseline?: Record<string, string>;
}

export type ConfirmResolution = "accurate" | "moved" | "spent";

export interface ConfirmMemory extends MemoryBase {
  kind: "confirm";
  assetKey: string;
  /** raw on-chain amount the owner confirmed as the new baseline */
  amount: string;
  resolution: ConfirmResolution;
  note?: Enc;
}

export interface LetterMemory extends MemoryBase {
  kind: "letter";
  value: Enc;
}

export interface CheckinMemory extends MemoryBase {
  kind: "checkin";
}

export interface SnapshotMemory extends MemoryBase {
  kind: "snapshot";
  /** 0..100, integer */
  score: number;
  coveredUsd: number;
  totalUsd: number;
  assets: number;
  covered: number;
  /** non-sensitive annotation for the chart, e.g. "answered where · 0x12…ab" */
  cause?: string;
}

export interface ReleaseMemory extends MemoryBase {
  kind: "release";
  reason: string;
  lastCheckin: string | null;
  lastOnchain: string | null;
  /** how the absence of life was verified: live Tatum lookup, labelled fixtures, or check-ins only (no Sui wallet to watch) */
  verifiedVia: "tatum" | "fixtures" | "checkins";
}

export type NokMemory =
  | VaultMemory
  | ProfileMemory
  | WalletMemory
  | FactMemory
  | ConfirmMemory
  | LetterMemory
  | CheckinMemory
  | SnapshotMemory
  | ReleaseMemory;

export type MemoryOf<K extends MemoryKind> = Extract<NokMemory, { kind: K }>;

/** Distributive Omit so each union member keeps its own fields. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a client sends to create a memory (server stamps nothing; client generates id + ts). */
export type NewMemory = NokMemory;

// ─── Storage ────────────────────────────────────────────────────────────────

export type StorageStatus = "pending" | "stored" | "failed";

/** A memory plus where it lives on Walrus. */
export interface StoredMemory {
  memory: NokMemory;
  /** the exact text written to Walrus Memory (codec output) */
  text: string;
  status: StorageStatus;
  jobId?: string;
  blobId?: string;
  /** when the relayer reports it was created */
  createdAt?: string;
  error?: string;
}

// ─── Chain data ─────────────────────────────────────────────────────────────

export type AssetKind = "coin" | "stake" | "native";

export interface Asset {
  /** sui:<addr>:coin:<coinType> | sui:<addr>:stake:<poolId> | ethereum:<addr>:native */
  key: string;
  walletId: string;
  chain: Chain;
  address: string;
  kind: AssetKind;
  symbol: string;
  decimals: number;
  /** integer string in base units */
  amountRaw: string;
  /** human units */
  amount: number;
  /** null when no price is available */
  usd: number | null;
  /** staked = not liquid */
  liquid: boolean;
  meta: {
    validatorName?: string;
    poolId?: string;
    coinType?: string;
    iconUrl?: string;
  };
}

export interface WalletScan {
  walletId: string;
  chain: Chain;
  address: string;
  assets: Asset[];
  /** ISO timestamp of the latest outgoing tx, if known */
  lastOutgoingTx: string | null;
  error?: string;
}

export interface ScanResult {
  scannedAt: string;
  wallets: WalletScan[];
  assets: Asset[];
  prices: Record<string, { usd: number; source: string; at: string }>;
  /** Tatum calls made during this scan */
  tatumCalls: number;
  mode: "live" | "fixtures";
}

// ─── Folded state ───────────────────────────────────────────────────────────

export interface NokState {
  vault: VaultMemory | null;
  /** latest profile */
  profile: ProfileMemory | null;
  /** ts of the first profile ever written (switch fallback for lastAlive) */
  profileCreatedAt: string | null;
  /** latest per walletId, ordered by first appearance */
  wallets: WalletMemory[];
  /** latest per (target, field) */
  facts: FactMemory[];
  /** latest confirm per assetKey */
  confirms: Record<string, ConfirmMemory>;
  letter: LetterMemory | null;
  lastCheckin: string | null;
  checkinCount: number;
  /** ascending by ts */
  snapshots: SnapshotMemory[];
  /** ascending by ts */
  releases: ReleaseMemory[];
  counts: { total: number; byKind: Record<MemoryKind, number> };
}

// ─── Readiness ──────────────────────────────────────────────────────────────

export interface AssetCoverage {
  assetKey: string;
  where: boolean;
  how: boolean;
  who: boolean;
  drifted: boolean;
  covered: boolean;
}

export interface Readiness {
  /** 0..100, rounded to an integer */
  score: number;
  /** usd when totalUsd > 0, otherwise by asset count */
  basis: "usd" | "count";
  coveredUsd: number;
  totalUsd: number;
  covered: number;
  assets: number;
  perAsset: AssetCoverage[];
}

// ─── Drift ──────────────────────────────────────────────────────────────────

export type DriftReason = "dropped" | "grew" | "missing";

export interface DriftItem {
  assetKey: string;
  walletId: string;
  reason: DriftReason;
  /** raw baseline amount */
  baseline: string;
  /** raw current amount ("0" when missing) */
  current: string;
  symbol: string;
  decimals: number;
}

export interface DriftReport {
  drifted: DriftItem[];
  /** asset keys present now but in no baseline — "new since last review", not drift */
  newAssets: string[];
}

// ─── Questions ──────────────────────────────────────────────────────────────

export type QuestionKind = "drift" | "where" | "how" | "who" | "how-stake" | "new-asset";

/**
 * Questions carry structured, non-sensitive data only. Wallet labels are
 * encrypted, so the browser renders the final wording via renderQuestion().
 */
export interface Question {
  /** stable id, e.g. "where:sui:0xabc" */
  id: string;
  kind: QuestionKind;
  /** the fact field this question writes (drift questions write a confirm) */
  field: FactField | null;
  /** walletId or assetKey the answer attaches to */
  target: string;
  walletId: string;
  assetKey?: string;
  /** percentage points of readiness gained immediately if answered (0..100, 1 decimal) */
  impactPct: number;
  /**
   * Fair share of the readiness gap this answer is responsible for: each
   * uncovered asset's share of the score is split equally across its missing
   * answers. Sums to (100 − score) across all questions, so it orders
   * questions by money protected even before any single answer completes an
   * asset (when every impactPct is still 0). 1 decimal.
   */
  sharePct: number;
  /** USD value that becomes covered if answered */
  usdAtStake: number;
  /** context for the template */
  context: {
    chain: Chain;
    address: string;
    shortAddress: string;
    symbol?: string;
    amount?: number;
    validatorName?: string;
    drift?: DriftItem;
  };
}

// ─── Dead man's switch ──────────────────────────────────────────────────────

export type SwitchPhase = "setup" | "alive" | "overdue" | "released";

export interface SwitchStatus {
  phase: SwitchPhase;
  now: string;
  lastAlive: string | null;
  lastAliveSource: "checkin" | "onchain" | "profile" | null;
  lastCheckin: string | null;
  lastOnchain: string | null;
  onchainAvailable: boolean;
  intervalSec: number;
  graceSec: number;
  /** lastAlive + interval */
  dueAt: string | null;
  /** lastAlive + interval + grace */
  releaseAt: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const VAULT_CHECK_PLAINTEXT = "nok-vault-check";
export const PBKDF2_ITERATIONS = 310_000;
export const DRIFT_LOW = 0.75;
export const DRIFT_HIGH = 1.33;

export const INTERVAL_PRESETS: ReadonlyArray<{ sec: number; label: string; demo?: boolean }> = [
  { sec: 180, label: "3 minutes", demo: true },
  { sec: 30 * 86400, label: "30 days" },
  { sec: 90 * 86400, label: "90 days" },
  { sec: 180 * 86400, label: "180 days" },
];

export function graceFor(intervalSec: number): number {
  return Math.round(intervalSec * 0.25);
}
