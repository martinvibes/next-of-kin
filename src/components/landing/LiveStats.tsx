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

/** Real figures from this deployment, nothing illustrative, set in white over the hero scene. */
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
    items.push({ v: s.memories.toLocaleString("en-US"), k: mock ? "Memories (mock store)" : "Memories on Walrus" });
    if (s.readiness) items.push({ v: String(s.readiness.score), unit: "%", k: "Vault readiness" });
    if (s.switch.lastAlive) {
      const a = since(s.switch.lastAlive);
      items.push({ v: a.n, unit: a.unit, k: "Since last sign of life" });
    }
  }

  const shadow = "[text-shadow:0_1px_2px_rgb(0_0_0/0.15),0_4px_32px_rgb(0_0_0/0.35)]";
  return (
    <div aria-live="polite" className={`text-white ${shadow}`}>
      {!s ? (
        <div className="flex flex-wrap justify-center gap-10 lg:gap-52">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-10 w-28 animate-pulse-soft rounded-lg bg-white/25" />
              <div className="h-3.5 w-24 animate-pulse-soft rounded bg-white/20" />
            </div>
          ))}
        </div>
      ) : !s.setup ? (
        <p className="text-center text-[15px]">No vault has been set up on this deployment yet.</p>
      ) : (
        <dl className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-24 lg:flex-nowrap lg:gap-x-52">
          {items.map((i, n) => (
            <div key={i.k} className={`flex flex-col items-center gap-1 ${n === 2 ? "col-span-2" : ""}`}>
              <dt className="order-2 text-[14px] leading-5">{i.k}</dt>
              <dd className="order-1 flex h-11 items-end gap-1 text-[40px] leading-none font-medium tracking-[-1.2px] tabular-nums">
                <Odometer value={i.v} />
                {i.unit && <span className="pb-[0.12em] text-[0.5em] leading-none font-medium tracking-normal text-white/80">{i.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
