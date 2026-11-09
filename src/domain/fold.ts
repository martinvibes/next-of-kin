/**
 * "Memory is the database": state is a deterministic fold over all memories.
 * Latest `ts` wins per key; ties are broken by memory id so every rebuild
 * produces the same state regardless of recall order.
 */
import type {
  ConfirmMemory,
  FactMemory,
  MemoryKind,
  NokMemory,
  NokState,
  ReleaseMemory,
  SnapshotMemory,
  WalletMemory,
} from "./types";

export const MEMORY_KINDS: readonly MemoryKind[] = [
  "vault",
  "profile",
  "wallet",
  "fact",
  "confirm",
  "letter",
  "checkin",
  "snapshot",
  "release",
];

function tsOf(m: { ts: string }): number {
  const t = Date.parse(m.ts);
  return Number.isNaN(t) ? 0 : t;
}

/** Ascending by ts, then id — so "later in the list" means "wins". */
export function compareMemories(a: NokMemory, b: NokMemory): number {
  return tsOf(a) - tsOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function factKey(target: string, field: string): string {
  return `${target}|${field}`;
}

export function emptyState(): NokState {
  return {
    vault: null,
    profile: null,
    profileCreatedAt: null,
    wallets: [],
    facts: [],
    confirms: {},
    letter: null,
    lastCheckin: null,
    checkinCount: 0,
    snapshots: [],
    releases: [],
    counts: { total: 0, byKind: Object.fromEntries(MEMORY_KINDS.map((k) => [k, 0])) as Record<MemoryKind, number> },
  };
}

export function dedupeMemories(memories: NokMemory[]): NokMemory[] {
  const seen = new Map<string, NokMemory>();
  for (const m of memories) if (!seen.has(m.id)) seen.set(m.id, m);
  return [...seen.values()];
}

export function foldMemories(memories: NokMemory[]): NokState {
  const state = emptyState();
  const ordered = dedupeMemories(memories).sort(compareMemories);

  const wallets = new Map<string, { first: number; memory: WalletMemory }>();
  const facts = new Map<string, FactMemory>();
  const confirms: Record<string, ConfirmMemory> = {};
  const snapshots: SnapshotMemory[] = [];
  const releases: ReleaseMemory[] = [];
  let order = 0;

  for (const m of ordered) {
    state.counts.total++;
    state.counts.byKind[m.kind]++;
    switch (m.kind) {
      case "vault":
        state.vault = m;
        break;
      case "profile":
        if (!state.profileCreatedAt) state.profileCreatedAt = m.ts;
        state.profile = m;
        break;
      case "wallet": {
        const prev = wallets.get(m.walletId);
        wallets.set(m.walletId, { first: prev ? prev.first : order++, memory: m });
        break;
      }
      case "fact":
        facts.set(factKey(m.target, m.field), m);
        break;
      case "confirm":
        confirms[m.assetKey] = m;
        break;
      case "letter":
        state.letter = m;
        break;
      case "checkin":
        state.lastCheckin = m.ts;
        state.checkinCount++;
        break;
      case "snapshot":
        snapshots.push(m);
        break;
      case "release":
        releases.push(m);
        break;
    }
  }

  state.wallets = [...wallets.values()].sort((a, b) => a.first - b.first).map((w) => w.memory);
  state.facts = [...facts.values()];
  state.confirms = confirms;
  state.snapshots = snapshots;
  state.releases = releases;
  return state;
}

/** Latest fact for (target, field), if any. */
export function findFact(state: NokState, target: string, field: FactMemory["field"]): FactMemory | undefined {
  let found: FactMemory | undefined;
  for (const f of state.facts) if (f.target === target && f.field === field) found = f;
  return found;
}
