"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/domain/format";
import type { StatusResponse } from "@/lib/api-types";
import { api } from "@/lib/client";

/** Real figures from this deployment. Nothing here is illustrative. */
export function LiveStats() {
  const [s, setS] = useState<StatusResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<StatusResponse>("/api/status")
      .then(setS)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  const mock = s?.memory.mode === "mock";

  const items: { k: string; v: string; tone: string }[] = s
    ? [
        { k: mock ? "memories, mock store" : "memories on Walrus Mainnet", v: String(s.memories), tone: "bg-violet" },
        ...(s.readiness ? [{ k: "vault readiness", v: `${s.readiness.score}%`, tone: "bg-mint" }] : []),
        ...(s.switch.lastAlive ? [{ k: "since last sign of life", v: relativeTime(s.switch.lastAlive, new Date().toISOString()).replace(/ ago$/, ""), tone: "bg-sky" }] : []),
      ]
    : [];

  return (
    <div className="mt-10" aria-live="polite">
      <p className="text-[0.75rem] text-fg-3">Live from this deployment</p>
      {!s ? (
        <div className="mt-3 flex gap-6">
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-10 w-28" />
        </div>
      ) : !s.setup ? (
        <p className="mt-2 text-[0.875rem] text-fg-2">No vault has been set up here yet.</p>
      ) : (
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-4">
          {items.map((i) => (
            <div key={i.k} className="min-w-0">
              <dt className="sr-only">{i.k}</dt>
              <dd className="flex items-center gap-2">
                <span className={`dot ${i.tone}`} aria-hidden="true" />
                <span className="t-num text-[1.35rem] leading-none font-semibold tracking-[-0.02em]">{i.v}</span>
              </dd>
              <dd className="mt-1 pl-4 text-[0.75rem] text-fg-3" aria-hidden="true">
                {i.k}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
