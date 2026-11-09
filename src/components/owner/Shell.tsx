"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { HeartPulse, Lock } from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";
import { Backdrop } from "@/components/motion/Backdrop";
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
const LEGACY: Record<string, View> = {
  overview: "home",
  agent: "questions",
  assets: "wallets",
  memory: "activity",
};

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

export function Shell({
  view,
  onView,
  status,
  counts,
  ownerName,
  onLock,
  topRight,
  children,
}: ShellProps) {
  const live = status.memory.mode === "mainnet";
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <Backdrop strength={0.55} height={520} />
      <header className="no-print sticky top-0 z-30 border-b border-line bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:h-[72px] sm:px-6">
          <Wordmark size={22} />
          <span className="hidden text-line-2 sm:inline" aria-hidden="true">
            /
          </span>
          <span className="hidden min-w-0 truncate text-[15px] font-medium sm:inline">
            {ownerName ? `${ownerName.split(/\s+/)[0]}'s vault` : "Your vault"}
          </span>
          <span
            className={`pill hidden md:inline-flex ${live ? "pill-mint" : "pill-rose"}`}
            title={
              live
                ? "Memories are written to Walrus Mainnet"
                : "Memories go to a local mock store, not Walrus"
            }
          >
            {live ? "Walrus Mainnet" : "Mock memory"}
          </span>
          <TabRail
            view={view}
            onView={onView}
            counts={counts}
            className="mx-auto hidden lg:flex"
          />
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {topRight}
            <button
              type="button"
              className="icon-btn"
              onClick={onLock}
              aria-label="Lock the vault"
              title="Lock"
            >
              <Lock />
            </button>
          </div>
        </div>
        <TabRail
          view={view}
          onView={onView}
          counts={counts}
          className="flex overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] sm:px-5 lg:hidden"
        />
      </header>
      <main
        id="main"
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-8 pb-24 sm:px-6 sm:pt-10"
      >
        {children}
      </main>
    </div>
  );
}

/** The vault's tabs. A soft pill slides to whichever one is open. */
function TabRail({
  view,
  onView,
  counts,
  className,
}: {
  view: View;
  onView: (v: View) => void;
  counts: Partial<Record<View, number>>;
  className: string;
}) {
  const wrap = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const box = wrap.current;
    const el = box?.querySelector<HTMLElement>(`[data-view="${view}"]`);
    if (!box || !el) return;
    const measure = () =>
      setPill(el.offsetWidth ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    measure();
    // keep the open tab in sight when the rail scrolls sideways on a phone
    if (box.scrollWidth > box.clientWidth)
      box.scrollTo({
        left: Math.max(0, el.offsetLeft - 24),
        behavior: "smooth",
      });
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [view]);

  return (
    <nav
      ref={wrap}
      className={`relative items-center gap-0.5 ${className}`}
      aria-label="Vault"
    >
      {pill && (
        <span
          className="absolute top-1/2 h-9 -translate-y-1/2 rounded-xl bg-[rgba(12,9,12,0.065)] transition-[left,width] duration-500 ease-[var(--ease-out)] lg:top-1/2"
          style={{ left: pill.x, width: pill.w }}
          aria-hidden="true"
        />
      )}
      {VIEWS.map((v) => {
        const active = v.id === view;
        const c = counts[v.id];
        return (
          <button
            key={v.id}
            type="button"
            data-view={v.id}
            onClick={() => onView(v.id)}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[15px] font-medium transition-colors duration-200 ${active ? "text-fg" : "text-[rgba(12,9,12,0.58)] hover:bg-[rgba(12,9,12,0.03)] hover:text-fg"}`}
          >
            {v.label}
            {c ? (
              <span
                className={`t-num rounded-md px-1.5 text-[11px] leading-[18px] font-medium ${v.id === "questions" ? "bg-fg text-white" : "bg-[rgba(12,9,12,0.07)] text-fg-2"}`}
              >
                {c}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/** The heartbeat button that lives in the top bar on every view. */
export function CheckinButton({
  sw,
  busy,
  done,
  onClick,
  left,
}: {
  sw: SwitchStatus | null;
  busy: boolean;
  done: boolean;
  onClick: () => void;
  left: string | null;
}) {
  const overdue = sw?.phase === "overdue";
  const released = sw?.phase === "released";
  return (
    <div className="flex items-center gap-2">
      {left && !released && (
        <span
          className={`t-num hidden text-[0.8125rem] md:inline ${overdue ? "text-amber" : "text-fg-3"}`}
          title={
            overdue
              ? "Grace period: released when this reaches zero"
              : "Time until your next check-in is due"
          }
        >
          {overdue ? `Opens in ${left}` : `Due in ${left}`}
        </span>
      )}
      <button
        type="button"
        className={`btn btn-sm ${overdue || released ? "btn-primary" : "btn-secondary"}`}
        onClick={onClick}
        disabled={busy || !sw || sw.phase === "setup"}
      >
        <HeartPulse className={overdue || released ? "" : "text-ember"} />
        {busy
          ? "Checking in…"
          : done
            ? "Checked in"
            : released
              ? "Reseal: I'm here"
              : "I'm still here"}
      </button>
    </div>
  );
}
