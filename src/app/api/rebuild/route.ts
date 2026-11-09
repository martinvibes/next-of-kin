import { isOwner } from "@/server/env";
import * as store from "@/server/store";
import { fail, route } from "@/server/api";
import type { RebuildResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const g = globalThis as unknown as { __nokRebuiltAt?: number };

/**
 * Throw away this server's cache and rebuild every memory from Walrus. Public
 * so anyone can check the claim "Walrus is the only database", but limited to
 * once a minute unless you're the owner.
 */
export const POST = route(async (req: Request) => {
  const owner = isOwner(req);
  const since = Date.now() - (g.__nokRebuiltAt ?? 0);
  if (!owner && since < 60_000) return fail(`Rebuilt ${Math.round(since / 1000)}s ago. Try again in ${Math.ceil((60_000 - since) / 1000)}s.`, 429, "rate-limited");
  g.__nokRebuiltAt = Date.now();
  const r = await store.rebuildFromWalrus({ clearFirst: store.storeInfo().pending === 0 });
  const body: RebuildResponse = {
    restored: r.restored,
    listed: r.inventoryError ? null : r.listed,
    dropped: r.dropped,
    queries: r.queries,
    complete: r.complete,
    tookMs: Date.parse(r.finishedAt) - Date.parse(r.startedAt),
    message: r.message,
  };
  return Response.json(body);
});
