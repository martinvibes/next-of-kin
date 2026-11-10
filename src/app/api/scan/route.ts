import { isOwner, ownerUnauthorized } from "@/server/env";
import * as store from "@/server/store";
import { cleanCause, readJson, route, scanResponse, secretIn } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner: read every wallet through Tatum, then drift, readiness and the next questions. */
export const POST = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  const body = await readJson(req);
  await store.adopt(body.recent, (m) => !secretIn(m));
  return Response.json(await scanResponse({ refresh: body.refresh === true, cause: cleanCause(body.cause) }));
});
