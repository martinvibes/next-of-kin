import { isOwner, ownerUnauthorized } from "@/server/env";
import * as store from "@/server/store";
import { fail, route } from "@/server/api";
import type { WriteResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner: has this write landed on Walrus yet? */
export const GET = route(async (req: Request) => {
  if (!isOwner(req)) return ownerUnauthorized();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  let rec = await store.getById(id);
  if (!rec) return fail("No memory with that id on this server.", 404, "invalid");
  if (rec.status === "pending" && rec.jobId) {
    await store.pollJob(rec.jobId);
    rec = (await store.getById(id)) ?? rec;
  }
  return Response.json({ stored: rec } satisfies WriteResponse);
});
