"use client";

import Link from "next/link";
import { HeartPulse, Lock } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import type { SwitchStatus } from "@/domain/types";
import type { StatusResponse } from "@/lib/api-types";

export type View = "home" | "questions" | "wallets" | "letter" | "activity";

export const VIEWS: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "questions", label: "Questions" },
  { id: "wallets", label: "Wallets" },
  { id: "letter", label: "Letter" },
  { id: "activity", label: "Activity" },
];

/** Old links (#agent, #assets, #memory, #overview) still land somewhere sensible. */
const LEGACY: Record<string, View> = { overview: "home", agent: "questions", assets: "wallets", memory: "activity" };

export function viewFromHash(): View {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace("#", "");
  return VIEWS.find((v) => v.id === h)?.id ?? LEGACY[h] ?? "home";
}

interface ShellProps {
  view: View;
  onView: (v: View) => void;
  status: StatusResponse;
  counts: Partial<Record<View, number>>;
  ownerName: string | null;
  onLock: () => void;
  topRight: React.ReactNode;
  children: React.ReactNode;
}

export function Shell({ view, onView, status, counts, ownerName, onLock, topRight, children }: ShellProps) {
  const live = status.memory.mode === "mainnet";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Next of Kin, home">
            <LogoMark size={24} />
          </Link>
          <span className="text-line-2" aria-hidden="true">
            /
          </span>
          <span className="min-w-0 truncate text-[0.875rem] font-medium">{ownerName ? `${ownerName.split(/\s+/)[0]}'s vault` : "Your vault"}</span>
          <span className={`pill hidden sm:inline-flex ${live ? "pill-mint" : "pill-rose"}`} title={live ? "Memories are written to Walrus Mainnet" : "Memories go to a local mock store, not Walrus"}>
            {live ? "Walrus Mainnet" : "Mock memory"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {topRight}
            <button type="button" className="icon-btn" onClick={onLock} aria-label="Lock the vault" title="Lock">
              <Lock />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-[1120px] overflow-x-auto px-1.5 [scrollbar-width:none] sm:gap-1 sm:px-4" aria-label="Vault">
          {VIEWS.map((v) => {
            const active = v.id === view;
            const c = counts[v.id];
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onView(v.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-11 shrink-0 items-center gap-1.5 px-2 text-[0.875rem] sm:px-2.5 transition-colors ${active ? "font-medium text-fg" : "text-fg-2 hover:text-fg"}`}
              >
                {v.label}
                {c ? <span className={`t-num rounded-md px-1.5 text-[0.7rem] leading-[1.15rem] font-medium ${v.id === "questions" ? "bg-fg text-white" : "bg-bg-2 text-fg-2"}`}>{c}</span> : null}
                {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-fg" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 pb-20 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/** The heartbeat button that lives in the top bar on every view. */
export function CheckinButton({ sw, busy, done, onClick, left }: { sw: SwitchStatus | null; busy: boolean; done: boolean; onClick: () => void; left: string | null }) {
  const overdue = sw?.phase === "overdue";
  const released = sw?.phase === "released";
  return (
    <div className="flex items-center gap-2">
      {left && !released && (
        <span className={`t-num hidden text-[0.8125rem] md:inline ${overdue ? "text-amber" : "text-fg-3"}`} title={overdue ? "Grace period: released when this reaches zero" : "Time until your next check-in is due"}>
          {overdue ? `Opens in ${left}` : `Due in ${left}`}
        </span>
      )}
      <button type="button" className={`btn btn-sm ${overdue || released ? "btn-primary" : "btn-secondary"}`} onClick={onClick} disabled={busy || !sw || sw.phase === "setup"}>
        <HeartPulse className={overdue || released ? "" : "text-ember"} />
        {busy ? "Checking in…" : done ? "Checked in" : released ? "Reseal: I'm here" : "I'm still here"}
      </button>
    </div>
  );
}
