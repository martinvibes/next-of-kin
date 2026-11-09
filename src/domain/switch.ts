/**
 * Dead man's switch.
 *
 * lastAlive = max(latest check-in, latest outgoing tx seen on-chain via Tatum,
 *                 profile creation).
 *   elapsed <  interval              → alive    (countdown)
 *   elapsed <  interval + grace      → overdue  (warning; heir still sealed)
 *   elapsed >= interval + grace      → released
 * On-chain liveness is ignored when the lookup is unavailable.
 */
import type { ProfileMemory, SwitchStatus } from "./types";

export interface SwitchInput {
  profile: Pick<ProfileMemory, "intervalSec" | "graceSec"> | null;
  profileCreatedAt: string | null;
  lastCheckin: string | null;
  lastOnchain: string | null;
  onchainAvailable: boolean;
  now: string;
}

function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function computeSwitch(input: SwitchInput): SwitchStatus {
  const { profile, now } = input;
  const lastOnchain = input.onchainAvailable ? input.lastOnchain : null;
  const base: SwitchStatus = {
    phase: "setup",
    now,
    lastAlive: null,
    lastAliveSource: null,
    lastCheckin: input.lastCheckin,
    lastOnchain,
    onchainAvailable: input.onchainAvailable,
    intervalSec: profile?.intervalSec ?? 0,
    graceSec: profile?.graceSec ?? 0,
    dueAt: null,
    releaseAt: null,
  };
  if (!profile) return base;

  // Ties prefer the owner's own check-in, then chain activity, then setup.
  const candidates: Array<[SwitchStatus["lastAliveSource"], number | null, string | null]> = [
    ["checkin", ms(input.lastCheckin), input.lastCheckin],
    ["onchain", ms(lastOnchain), lastOnchain],
    ["profile", ms(input.profileCreatedAt), input.profileCreatedAt],
  ];
  let best: [SwitchStatus["lastAliveSource"], number, string] | null = null;
  for (const [src, t, iso] of candidates) {
    if (t === null || iso === null) continue;
    if (!best || t > best[1]) best = [src, t, iso];
  }
  if (!best) return { ...base, phase: "alive" };

  const nowMs = Date.parse(now);
  const dueMs = best[1] + profile.intervalSec * 1000;
  const releaseMs = dueMs + profile.graceSec * 1000;
  const phase: SwitchStatus["phase"] = nowMs < dueMs ? "alive" : nowMs < releaseMs ? "overdue" : "released";
  return {
    ...base,
    phase,
    lastAlive: new Date(best[1]).toISOString(),
    lastAliveSource: best[0],
    dueAt: new Date(dueMs).toISOString(),
    releaseAt: new Date(releaseMs).toISOString(),
  };
}

/** Seconds until the next phase change (0 once released). */
export function secondsUntilNextPhase(s: SwitchStatus): number {
  const now = Date.parse(s.now);
  if (s.phase === "alive" && s.dueAt) return Math.max(0, (Date.parse(s.dueAt) - now) / 1000);
  if (s.phase === "overdue" && s.releaseAt) return Math.max(0, (Date.parse(s.releaseAt) - now) / 1000);
  return 0;
}
