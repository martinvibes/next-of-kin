"use client";

import { ArrowRight, Coins, Database, PenLine, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";
import { formatUsd, relativeTime } from "@/domain/format";
import { greeting } from "@/lib/time";
import type { OwnerCtx } from "./useOwner";
import type { View } from "./Shell";
import type { Checkin } from "./Dashboard";
import { ReadinessCard } from "./ReadinessCard";
import { AgentPanel } from "./QuestionArea";
import { LifeCard } from "./SwitchCard";
import { ReadinessChart } from "./ReadinessChart";
import { AssetsTable } from "./Ledger";
import { MemoryFeed } from "./MemoryFeed";

export function Overview({ o, go, ci }: { o: OwnerCtx; go: (v: View) => void; ci: Checkin }) {
  const owner = o.dec?.ownerName?.trim().split(/\s+/)[0];
  const heir = o.dec?.heirName?.trim() || "Your heir";
  const r = o.scan?.readiness;
  const wallets = o.state?.state.wallets.length ?? 0;
  const assets = o.scan?.scan.assets.length ?? 0;
  const questions = o.scan?.questions ?? [];
  const top = questions[0];
  const memories = o.state?.memories ?? [];
  const lastKept = memories.reduce<string | null>((m, s) => (!m || s.memory.ts > m ? s.memory.ts : m), null);
  const letter = o.dec?.letter?.trim();
  const words = letter ? letter.split(/\s+/).length : 0;

  let headline: React.ReactNode = <span className="skeleton inline-block h-8 w-80 max-w-full align-middle" />;
  if (o.state && wallets === 0) headline = "Add a wallet and the agent gets to work.";
  else if (r && r.basis === "usd")
    headline = (
      <>
        {heir} could recover <span className="text-mint">{formatUsd(r.coveredUsd)}</span> of {formatUsd(r.totalUsd)} today.
      </>
    );
  else if (r) headline = `${heir} knows enough for ${r.covered} of ${r.assets} assets.`;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-fg-3">
            {greeting()}
            {owner ? `, ${owner}` : ""}
          </p>
          <h2 className="mt-1 text-[1.45rem] leading-tight font-semibold tracking-[-0.03em] sm:text-[1.8rem]">{headline}</h2>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => o.runScan({ refresh: true })} disabled={o.scanning}>
          <RefreshCw className={o.scanning ? "animate-spin" : ""} />
          {o.scanning ? "Reading the chain…" : "Rescan"}
        </button>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <ReadinessCard o={o} className="lg:col-span-5" />
        <div className="min-w-0 lg:col-span-7">
          <AgentPanel o={o} compact onOpenAgent={() => go("agent")} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-label="At a glance">
        <Stat
          icon={Coins}
          tone="sky"
          label="Value watched"
          value={r ? (r.totalUsd > 0 ? formatUsd(r.totalUsd) : `${assets}`) : null}
          sub={`${assets} ${assets === 1 ? "asset" : "assets"} · ${wallets} ${wallets === 1 ? "wallet" : "wallets"}`}
          onClick={() => go("assets")}
        />
        <Stat
          icon={Sparkles}
          tone="mint"
          label="Questions left"
          value={o.scan ? String(questions.length) : null}
          sub={top ? (top.kind === "drift" ? "One needs a check" : top.impactPct > 0 ? `Next: +${Math.round(top.impactPct)}% readiness` : "Most valuable first") : "Nothing left to ask"}
          onClick={() => go("agent")}
        />
        <Stat
          icon={Database}
          tone="violet"
          label={o.status.memory.mode === "mainnet" ? "Memories on Walrus" : "Memories (mock)"}
          value={o.state ? String(o.state.state.counts.total) : null}
          sub={lastKept ? `Last kept ${relativeTime(lastKept, new Date().toISOString())}` : "None yet"}
          onClick={() => go("memory")}
        />
        <Stat
          icon={PenLine}
          tone={letter ? "mint" : "amber"}
          label="Your letter"
          value={o.dec ? (letter ? "Written" : "Not yet") : null}
          sub={letter ? `${words} ${words === 1 ? "word" : "words"}, encrypted` : "A few words matter most"}
          onClick={() => go("letter")}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <ReadinessChart snapshots={o.scan?.snapshots ?? o.state?.state.snapshots ?? []} />
        </div>
        <LifeCard o={o} ci={ci} className="lg:col-span-5" />
      </section>

      <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <AssetsTable o={o} limit={5} onViewAll={() => go("assets")} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <MemoryFeed o={o} limit={6} onViewAll={() => go("memory")} />
        </div>
      </section>
    </div>
  );
}

const TONE: Record<string, string> = {
  sky: "bg-sky-wash text-sky",
  mint: "bg-mint-wash text-mint",
  violet: "bg-violet-wash text-violet",
  amber: "bg-amber-wash text-amber",
};

function Stat({ icon: Icon, tone, label, value, sub, onClick }: { icon: LucideIcon; tone: string; label: string; value: string | null; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card group flex flex-col p-4 text-left transition-colors hover:border-line-2 hover:bg-panel-2 sm:p-5">
      <span className="flex items-center justify-between">
        <span className={`grid size-8 place-items-center rounded-lg ${TONE[tone]}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <ArrowRight className="size-3.5 -translate-x-1 text-fg-3 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
      </span>
      <span className="mt-4 text-[0.78rem] text-fg-3">{label}</span>
      {value === null ? <span className="skeleton mt-1.5 h-7 w-20" /> : <span className="t-num mt-0.5 text-[1.35rem] font-semibold tracking-[-0.02em] sm:text-[1.55rem]">{value}</span>}
      <span className="mt-1 line-clamp-1 text-[0.75rem] text-fg-2">{sub}</span>
    </button>
  );
}
