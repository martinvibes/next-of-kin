import type { StatusResponse } from "@/lib/api-types";

/** Honest labelling: a thin strip whenever memory or chain data isn't the real thing. */
export function ModeBanner({ status }: { status: Pick<StatusResponse, "memory" | "chain"> | null }) {
  if (!status) return null;
  const notes: string[] = [];
  if (status.memory.mode === "mock") notes.push("Mock memory, not Walrus");
  if (status.chain.mode === "fixtures") notes.push("Fixture chain data, not live");
  if (status.chain.mode === "unavailable") notes.push("Chain data unavailable: Tatum key missing");
  if (!notes.length) return null;
  return (
    <div className="no-print relative z-50 border-b border-[#f1d5d0] bg-rose-wash text-center text-[0.78rem] font-medium text-rose" role="note">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5">
        <span className="dot bg-rose" aria-hidden="true" />
        {notes.join(" · ")}
      </p>
    </div>
  );
}
