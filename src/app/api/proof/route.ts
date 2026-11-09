import { summarize } from "@/domain/codec";
import { chainMode, getEnv } from "@/server/env";
import { health, listAll, publicKeyHex } from "@/server/memwal";
import * as store from "@/server/store";
import { route } from "@/server/api";
import { tatumStats, TtlCache } from "@/server/tatum/queue";
import { latestCheckpoint, type CheckpointInfo } from "@/server/tatum/sui";
import type { ProofResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const g = globalThis as unknown as { __nokCkpt?: TtlCache<CheckpointInfo> };
const ckptCache = (g.__nokCkpt ??= new TtlCache());

/** Public: everything a judge needs to verify the memory and chain claims. Summaries only, never ciphertext. */
export const GET = route(async () => {
  const env = getEnv();
  const mode = chainMode();
  const [h, all, publicKey, inventory, ckpt] = await Promise.all([
    health(),
    store.getAll(),
    publicKeyHex(),
    listAll().then(
      (l) => ({ ok: true as const, l }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
    ),
    mode === "live"
      ? ckptCache.getOrLoad("c", 15_000, latestCheckpoint).then(
          (c) => ({ ok: true as const, c }),
          (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
        )
      : Promise.resolve({ ok: false as const, error: mode === "fixtures" ? "Fixture mode: the chain isn't queried." : "TATUM_API_KEY is not set." }),
  ]);
  const stats = tatumStats();
  const body: ProofResponse = {
    memory: {
      mode: h.mode,
      ok: h.ok,
      status: h.status,
      ...(h.version ? { version: h.version } : {}),
      ...(h.error ? { error: h.error } : {}),
      namespace: env.namespace,
      publicKey,
      agentIds: inventory.ok ? [...new Set(inventory.l.map((m) => m.agent_id).filter((a): a is string => !!a))] : [],
    },
    chain: {
      mode,
      calls: stats.total,
      byLabel: stats.byLabel,
      ...(stats.lastError ? { lastError: `${stats.lastError.label}: ${stats.lastError.message}` } : {}),
      checkpoint: ckpt.ok ? { sequenceNumber: String(ckpt.c.sequenceNumber), timestamp: ckpt.c.timestamp ?? null } : null,
      ...(ckpt.ok ? {} : { checkpointError: ckpt.error }),
    },
    rows: [...all].reverse().map((m) => ({
      id: m.memory.id,
      kind: m.memory.kind,
      summary: summarize(m.memory),
      ts: m.memory.ts,
      ...(m.createdAt ? { createdAt: m.createdAt } : {}),
      ...(m.blobId ? { blobId: m.blobId } : {}),
      status: m.status,
    })),
    listed: inventory.ok ? inventory.l.length : null,
    ...(inventory.ok ? {} : { listedError: inventory.error }),
    dropped: store.storeInfo().lastRebuild?.dropped ?? 0,
  };
  return Response.json(body);
});
