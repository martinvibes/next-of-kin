"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, Database, HeartPulse, KeyRound, MessageSquareText, PenLine, TrendingUp, Unlock, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { summarize } from "@/domain/codec";
import { relativeTime } from "@/domain/format";
import type { MemoryKind, StoredMemory } from "@/domain/types";
import { BlobLink, StatusDot } from "@/components/Receipt";
import type { OwnerCtx } from "./useOwner";
import { ReadinessChart } from "./ReadinessChart";

export const KIND: Record<MemoryKind, { label: string; icon: LucideIcon; tone: string }> = {
  vault: { label: "Vault", icon: KeyRound, tone: "bg-violet-wash text-violet" },
  profile: { label: "Profile", icon: UserRound, tone: "bg-violet-wash text-violet" },
  wallet: { label: "Wallet", icon: Wallet, tone: "bg-sky-wash text-sky" },
  fact: { label: "Answer", icon: MessageSquareText, tone: "bg-mint-wash text-mint" },
  confirm: { label: "Confirmation", icon: CheckCheck, tone: "bg-amber-wash text-amber" },
  letter: { label: "Letter", icon: PenLine, tone: "bg-mint-wash text-mint" },
  checkin: { label: "Check-in", icon: HeartPulse, tone: "bg-mint-wash text-mint" },
  snapshot: { label: "Snapshot", icon: TrendingUp, tone: "bg-black/[0.04] text-fg-2" },
  release: { label: "Release", icon: Unlock, tone: "bg-rose-wash text-rose" },
};

function detail(s: StoredMemory) {
  return summarize(s.memory).replace(/^[a-z]+ · /, "");
}

function Row({ s, mock, now }: { s: StoredMemory; mock: boolean; now: string }) {
  const k = KIND[s.memory.kind];
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${k.tone}`} aria-hidden="true">
        <k.icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[0.8125rem] font-medium">
          {k.label}
          <span className="text-[0.72rem] font-normal text-fg-3">{relativeTime(s.memory.ts, now)}</span>
        </span>
        <span className="block truncate text-[0.75rem] text-fg-3">{detail(s)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {s.blobId ? (
          <BlobLink blobId={s.blobId} mock={mock} />
        ) : (
          <>
            <StatusDot status={s.status} />
            <span className={`text-[0.72rem] ${s.status === "failed" ? "text-rose" : "text-fg-3"}`}>{s.status === "failed" ? "not stored" : "writing…"}</span>
          </>
        )}
      </span>
    </li>
  );
}

function sorted(o: OwnerCtx) {
  return [...(o.state?.memories ?? [])].sort((a, b) => b.memory.ts.localeCompare(a.memory.ts));
}

/** The latest memories, newest first, each with its Walrus blob. */
export function MemoryFeed({ o, limit = 6, onViewAll }: { o: OwnerCtx; limit?: number; onViewAll?: () => void }) {
  const mock = o.status.memory.mode === "mock";
  const all = sorted(o);
  const now = new Date().toISOString();
  return (
    <section className="card overflow-hidden" aria-labelledby="feed-title">
      <div className="card-head">
        <h2 id="feed-title" className="card-title">
          <Database className="size-4" aria-hidden="true" />
          {mock ? "Memory (mock store)" : "Memory on Walrus"}
        </h2>
        {onViewAll && all.length > 0 && (
          <button type="button" onClick={onViewAll} className="inline-flex items-center gap-1 text-[0.75rem] text-fg-2 hover:text-fg">
            All {all.length} <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
      {!o.state ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <p className="px-5 py-8 text-center text-[0.8125rem] text-fg-3">No memories yet.</p>
      ) : (
        <ul className="divide-y divide-line py-1">
          {all.slice(0, limit).map((s) => (
            <Row key={s.memory.id} s={s} mock={mock} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Every memory, filterable by kind, with the readiness history above it. */
export function MemoryView({ o }: { o: OwnerCtx }) {
  const mock = o.status.memory.mode === "mock";
  const [filter, setFilter] = useState<MemoryKind | "all">("all");
  const all = sorted(o);
  const kinds = [...new Set(all.map((s) => s.memory.kind))];
  const rows = filter === "all" ? all : all.filter((s) => s.memory.kind === filter);
  const stored = all.filter((s) => s.status === "stored").length;
  const now = new Date().toISOString();

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Mini label={mock ? "Memories (mock store)" : "Memories on Walrus"} value={String(all.length)} />
        <Mini label="Confirmed with a blob" value={`${stored} of ${all.length}`} />
        <Mini label="Readiness snapshots" value={String(all.filter((s) => s.memory.kind === "snapshot").length)} />
      </section>

      <ReadinessChart snapshots={o.scan?.snapshots ?? o.state?.state.snapshots ?? []} />

      <section className="card overflow-hidden" aria-labelledby="all-mem">
        <div className="card-head flex-wrap">
          <h2 id="all-mem" className="card-title">
            <Database className="size-4" aria-hidden="true" />
            Every memory
          </h2>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by kind">
            {(["all", ...kinds] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`rounded-md px-2 py-1 text-[0.72rem] transition-colors ${filter === k ? "bg-black/[0.04] text-fg" : "text-fg-3 hover:text-fg"}`}
              >
                {k === "all" ? "All" : KIND[k].label}
              </button>
            ))}
          </div>
        </div>
        <p className="border-b border-line px-5 py-2.5 text-[0.75rem] text-fg-3">Summaries only. Labels, answers, names and the letter are encrypted in your browser and never appear in plain text.</p>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-[0.8125rem] text-fg-3">No memories yet.</p>
        ) : (
          <ul className="divide-y divide-line py-1">
            {rows.map((s) => (
              <Row key={s.memory.id} s={s} mock={mock} now={now} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[0.75rem] text-fg-3">{label}</p>
      <p className="t-num mt-1 text-[1.25rem] font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}
