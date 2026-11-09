import { getEnv, isOwner, ownerUnauthorized } from "@/server/env";
import * as store from "@/server/store";
import { route, switchFor } from "@/server/api";
import type { StateResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner: the folded state (encrypted fields stay encrypted) plus every stored memory. */
export const GET = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  const [state, memories] = await Promise.all([store.getState(), store.getAll()]);
  const { sw } = await switchFor(state);
  const env = getEnv();
  const body: StateResponse = {
    state,
    memories,
    switch: sw,
    suggestedWallets: [
      ...env.suiAddresses.map((address) => ({ chain: "sui" as const, address })),
      ...(env.ethAddress ? [{ chain: "ethereum" as const, address: env.ethAddress }] : []),
    ],
  };
  return Response.json(body);
});
