import * as store from "@/server/store";
import { ensureRelease, route, scanFor, switchFor } from "@/server/api";
import type { Asset } from "@/domain/types";
import type { HeirBundleResponse, ReleasedBundle } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public. Before release: only the switch timing. After release: the encrypted
 * vault (the heir decrypts it in the browser with the passphrase they were
 * given) plus live balances read through Tatum, and an audit memory on Walrus.
 */
export const GET = route(async () => {
  let state = await store.getState();
  let { sw, live } = await switchFor(state);
  // Re-verify on-chain silence with a fresh read before anything is released.
  if (sw.phase === "released") ({ sw, live } = await switchFor(state, { fresh: true }));

  const sealed = (phase: "setup" | "alive" | "overdue"): HeirBundleResponse => ({
    phase,
    switch: { phase, lastAlive: sw.lastAlive, lastAliveSource: sw.lastAliveSource, intervalSec: sw.intervalSec, graceSec: sw.graceSec, dueAt: sw.dueAt, releaseAt: sw.releaseAt, onchainAvailable: sw.onchainAvailable, now: sw.now },
  });

  if (sw.phase !== "released" || !state.vault) return Response.json(sealed(sw.phase === "released" ? "overdue" : sw.phase));

  const audit = await ensureRelease(state, sw, live);
  if (!audit) return Response.json(sealed("overdue")); // chain unreadable right now: stay sealed
  state = await store.getState();

  let assets: Asset[] = [];
  let scannedAt: string | null = null;
  let scanError: string | undefined;
  try {
    const scan = await scanFor(state);
    assets = scan.assets;
    scannedAt = scan.scannedAt;
  } catch (err) {
    scanError = err instanceof Error ? err.message : "Couldn't read balances.";
  }

  const body: ReleasedBundle = {
    phase: "released",
    switch: sw,
    vault: state.vault!,
    profile: state.profile,
    wallets: state.wallets,
    facts: state.facts,
    confirms: Object.values(state.confirms),
    letter: state.letter,
    assets,
    scannedAt,
    ...(scanError ? { scanError } : {}),
    audit: { memory: audit.memory, ...(audit.stored?.blobId ? { blobId: audit.stored.blobId } : {}), status: audit.stored?.status ?? "stored" },
  };
  return Response.json(body);
});
