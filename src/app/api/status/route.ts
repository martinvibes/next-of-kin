import { getEnv, chainMode } from "@/server/env";
import { health } from "@/server/memwal";
import * as store from "@/server/store";
import { route, switchFor } from "@/server/api";
import { TtlCache } from "@/server/tatum/queue";
import type { StatusResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const g = globalThis as unknown as { __nokHealth?: TtlCache<Awaited<ReturnType<typeof health>>> };
const healthCache = (g.__nokHealth ??= new TtlCache());

/** Public: what this deployment is, and whether it's real. No owner data. */
export const GET = route(async () => {
  void getEnv();
  const [h, state] = await Promise.all([healthCache.getOrLoad("h", 30_000, health), store.getState()]);
  const { sw } = await switchFor(state);
  const last = state.snapshots[state.snapshots.length - 1];
  const body: StatusResponse = {
    memory: { mode: h.mode, ok: h.ok, status: h.status, ...(h.version ? { version: h.version } : {}), ...(h.error ? { error: h.error } : {}) },
    chain: { mode: chainMode() },
    setup: !!(state.vault && state.profile),
    switch: sw,
    readiness: last ? { score: last.score, at: last.ts } : null,
    memories: state.counts.total,
    demoInterval: !!state.profile && state.profile.intervalSec < 3600,
  };
  return Response.json(body);
});
