/** Response shapes shared by API routes and the browser. */
import type {
  Asset,
  DriftReport,
  NokMemory,
  NokState,
  Question,
  Readiness,
  ScanResult,
  StoredMemory,
  SwitchStatus,
  ReleaseMemory,
  WalletMemory,
  FactMemory,
  ConfirmMemory,
  LetterMemory,
  ProfileMemory,
  VaultMemory,
  SnapshotMemory,
} from "@/domain/types";

export type MemoryMode = "mainnet" | "mock";
export type ChainMode = "live" | "fixtures" | "unavailable";

export interface StatusResponse {
  memory: { mode: MemoryMode; ok: boolean; status?: string; version?: string; error?: string };
  chain: { mode: ChainMode };
  setup: boolean;
  switch: SwitchStatus;
  readiness: { score: number; at: string } | null;
  memories: number;
  demoInterval: boolean;
}

export interface StateResponse {
  state: NokState;
  memories: StoredMemory[];
  switch: SwitchStatus;
  /** wallet addresses suggested from env (owner only) */
  suggestedWallets: { chain: "sui" | "ethereum"; address: string }[];
}

export interface ScanResponse {
  scan: ScanResult;
  drift: DriftReport;
  readiness: Readiness;
  questions: Question[];
  /** written when readiness changed by >= 1 point */
  snapshot: StoredMemory | null;
  snapshots: SnapshotMemory[];
}

export interface WriteResponse {
  stored: StoredMemory;
}

export interface SealedBundle {
  phase: "setup" | "alive" | "overdue";
  switch: Pick<SwitchStatus, "phase" | "lastAlive" | "lastAliveSource" | "intervalSec" | "graceSec" | "dueAt" | "releaseAt" | "onchainAvailable" | "now">;
}

export interface ReleasedBundle {
  phase: "released";
  switch: SwitchStatus;
  vault: VaultMemory;
  profile: ProfileMemory | null;
  wallets: WalletMemory[];
  facts: FactMemory[];
  confirms: ConfirmMemory[];
  letter: LetterMemory | null;
  assets: Asset[];
  scannedAt: string | null;
  scanError?: string;
  audit: { memory: ReleaseMemory; blobId?: string; status: StoredMemory["status"] } | null;
}

export type HeirBundleResponse = SealedBundle | ReleasedBundle;

export interface ProofMemoryRow {
  id: string;
  kind: NokMemory["kind"];
  summary: string;
  ts: string;
  createdAt?: string;
  blobId?: string;
  status: StoredMemory["status"];
}

export interface ProofResponse {
  memory: StatusResponse["memory"] & { namespace: string; publicKey: string | null; agentIds: string[] };
  chain: { mode: ChainMode; calls: number; byLabel: Record<string, number>; lastError?: string; checkpoint: { sequenceNumber: string; timestamp: string | null } | null; checkpointError?: string };
  rows: ProofMemoryRow[];
  listed: number | null;
  listedError?: string;
  dropped: number;
}

export interface RebuildResponse {
  restored: number;
  listed: number | null;
  dropped: number;
  queries: string[];
  complete: boolean;
  tookMs: number;
}

export interface ApiError {
  error: string;
  code?: "unauthorized" | "invalid" | "secret-detected" | "not-setup" | "upstream" | "rate-limited";
}
