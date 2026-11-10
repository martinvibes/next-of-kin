import { getEnv, isOwner, ownerUnauthorized } from "@/server/env";
import * as store from "@/server/store";
import { readJson, route, secretIn, switchFor } from "@/server/api";
import type { StateResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner: the folded state (encrypted fields stay encrypted) plus every stored memory. */
export const GET = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  return Response.json(await stateBody());
});

/** Same, after folding in the writes this browser made (see store.adopt). */
export const POST = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  const body = await readJson(req);
  await store.adopt(body.recent, (m) => !secretIn(m));
  return Response.json(await stateBody());
});

async function stateBody(): Promise<StateResponse> {
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
  return body;
}
