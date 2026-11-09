import type { StatusResponse } from "@/lib/api-types";

/** Honest labelling: shows when memory or chain data isn't the real thing. */
export function ModeBanner({ status }: { status: Pick<StatusResponse, "memory" | "chain"> | null }) {
  if (!status) return null;
  const notes: string[] = [];
  if (status.memory.mode === "mock") notes.push("MOCK MEMORY — not on Walrus");
  if (status.chain.mode === "fixtures") notes.push("FIXTURE CHAIN DATA — not live");
  if (status.chain.mode === "unavailable") notes.push("Chain data unavailable — Tatum key missing");
  if (!notes.length) return null;
  return (
    <div className="no-print bg-claret text-center text-[0.8125rem] font-semibold tracking-wide text-white" role="note">
      <p className="mx-auto max-w-6xl px-4 py-2">{notes.join("  ·  ")}</p>
    </div>
  );
}
