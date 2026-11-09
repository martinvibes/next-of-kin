import { newId } from "@/domain/ids";
import type { CheckinMemory } from "@/domain/types";
import { isOwner, ownerUnauthorized } from "@/server/env";
import * as store from "@/server/store";
import { fail, route, switchFor } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner: "I'm still here." Resets the switch and is kept on Walrus. */
export const POST = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  const before = await store.getState();
  if (!before.profile) return fail("Finish setup before checking in.", 409, "not-setup");
  const memory: CheckinMemory = { v: 1, id: newId(), kind: "checkin", ts: new Date().toISOString() };
  const stored = await store.write(memory);
  const { sw } = await switchFor(await store.getState());
  return Response.json({ stored, switch: sw });
});
