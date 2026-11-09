import { parseMemory } from "@/domain/codec";
import { isOwner, ownerUnauthorized } from "@/server/env";
import * as store from "@/server/store";
import { fail, isWriteAllowed, readJson, route, secretIn, secretRejected } from "@/server/api";
import type { WriteResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Owner: write one memory to Walrus Memory. Sensitive fields arrive already
 * encrypted by the browser; every remaining plaintext string is checked for
 * seed phrases and private keys before anything leaves this server.
 */
export const POST = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  const body = await readJson(req);
  if (secretIn(body.memory)) return secretRejected();
  const parsed = parseMemory(body.memory);
  if (!parsed.ok) return fail(`That memory isn't valid: ${parsed.error}`, 400, "invalid");
  const state = await store.getState();
  const refusal = isWriteAllowed(parsed.memory, state);
  if (refusal) return fail(refusal, 409, parsed.memory.kind === "vault" || !state.vault ? "not-setup" : "invalid");
  const stored = await store.write(parsed.memory);
  return Response.json({ stored } satisfies WriteResponse);
});
