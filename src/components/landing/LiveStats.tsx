"use client";

import { useEffect, useState } from "react";
import type { StatusResponse } from "@/lib/api-types";
import { api } from "@/lib/client";
import { Odometer } from "@/components/ui/Odometer";

function since(iso: string): { n: string; unit: string } {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return { n: String(Math.max(1, Math.round(s / 60))), unit: "min" };
  if (s < 86400 * 2) return { n: String(Math.round(s / 3600)), unit: "h" };
  return { n: String(Math.round(s / 86400)), unit: "days" };
}

/** Real figures from this deployment, nothing illustrative. Rolls into place on load. */
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
  const items: { v: string; unit?: string; k: string }[] = [];
  if (s) {
    items.push({ v: s.memories.toLocaleString("en-US"), k: mock ? "Memories (mock store)" : "Memories on Walrus Mainnet" });
    if (s.readiness) items.push({ v: String(s.readiness.score), unit: "%", k: "Vault readiness" });
    if (s.switch.lastAlive) {
      const a = since(s.switch.lastAlive);
      items.push({ v: a.n, unit: a.unit, k: "Since last sign of life" });
    }
  }

  return (
    <div aria-live="polite">
      {!s ? (
        <div className="flex justify-center gap-10 sm:gap-20">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="skeleton h-9 w-20" />
              <div className="skeleton h-3 w-28" />
            </div>
          ))}
        </div>
      ) : !s.setup ? (
        <p className="text-center text-[0.875rem] text-fg-2">No vault has been set up on this deployment yet.</p>
      ) : (
        <dl className="flex flex-wrap justify-center gap-x-10 gap-y-6 sm:gap-x-20">
          {items.map((i) => (
            <div key={i.k} className="flex flex-col items-center">
              <dt className="order-2 mt-2 text-[0.8125rem] text-fg-2">{i.k}</dt>
              <dd className="order-1 flex items-baseline gap-1 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.04em]">
                <Odometer value={i.v} />
                {i.unit && <span className="text-[0.55em] font-medium tracking-normal text-fg-3">{i.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
