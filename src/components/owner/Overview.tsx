"use client";

import { ChevronRight, PenLine } from "lucide-react";
import type { OwnerCtx } from "./useOwner";
import type { View } from "./Shell";
import type { Checkin } from "./Dashboard";
import { ReadinessHero } from "./ReadinessCard";
import { AgentPanel } from "./QuestionArea";
import { LifeCard } from "./SwitchCard";
import { AssetsTable } from "./Ledger";

/** Home: where things stand, the one thing to do next, and proof of life. Everything else is a tab away. */
export function Overview({ o, go, ci }: { o: OwnerCtx; go: (v: View) => void; ci: Checkin }) {
  const letter = o.dec?.letter?.trim();
  const heir = o.dec?.heirName?.trim() || "your heir";

  return (
    <div className="space-y-8">
      <ReadinessHero o={o} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="min-w-0" aria-label="Next question">
          <AgentPanel o={o} compact onOpenAgent={() => go("questions")} />
        </section>
        <section className="min-w-0" aria-label="Proof of life">
          <LifeCard o={o} ci={ci} />
        </section>
      </div>

      {o.dec && !letter && (
        <button type="button" onClick={() => go("letter")} className="card group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:border-line-2">
          <span className="grid size-9 place-items-center rounded-full bg-bg-2 text-fg-2">
            <PenLine className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">Write a few words to {heir}</span>
            <span className="block text-[0.8125rem] text-fg-3">It&rsquo;s the first thing they read. Encrypted like everything else.</span>
          </span>
          <ChevronRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      )}

      <AssetsTable o={o} limit={5} onViewAll={() => go("wallets")} />
    </div>
  );
}
