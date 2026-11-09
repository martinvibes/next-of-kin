"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StatusResponse } from "@/lib/api-types";

function ago(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** A quiet line under the hero showing this deployment's real state. */
export function LiveStrip() {
  const [s, setS] = useState<StatusResponse | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: StatusResponse | null) => alive && setS(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!s) return <p className="mt-10 h-5" aria-hidden="true" />;
  const now = Date.now();
  const parts: string[] = [];
  if (s.readiness) parts.push(`heir readiness ${s.readiness.score}%`);
  parts.push(`${s.memories} ${s.memories === 1 ? "memory" : "memories"} on ${s.memory.mode === "mainnet" ? "Walrus Mainnet" : "a mock store"}`);
  const seen = ago(s.switch.lastAlive, now);
  if (seen) parts.push(`owner last seen ${seen}`);

  return (
    <p className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
      <span className={`inline-block h-2 w-2 rounded-full ${s.memory.mode === "mainnet" ? "bg-moss" : "bg-claret"}`} aria-hidden="true" />
      <span>This deployment, live:</span>
      <Link href="/proof" className="link text-ink">
        {parts.join(", ")}
      </Link>
    </p>
  );
}
