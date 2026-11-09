"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Coins,
  Database,
  HeartPulse,
  LayoutDashboard,
  Lock,
  Menu,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import type { SwitchStatus } from "@/domain/types";
import type { StatusResponse } from "@/lib/api-types";

export type View = "overview" | "agent" | "assets" | "wallets" | "letter" | "memory";

export const VIEWS: { id: View; label: string; icon: LucideIcon; title: string; sub: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, title: "Overview", sub: "What your heir would find today" },
  { id: "agent", label: "Agent", icon: Sparkles, title: "Agent", sub: "One question at a time, the most valuable first" },
  { id: "assets", label: "Assets", icon: Coins, title: "Assets", sub: "Everything Tatum can see in your wallets" },
  { id: "wallets", label: "Wallets", icon: Wallet, title: "Wallets", sub: "Public addresses the agent watches" },
  { id: "letter", label: "Letter", icon: PenLine, title: "Your letter", sub: "The first thing your heir reads" },
  { id: "memory", label: "Memory", icon: Database, title: "Memory", sub: "Every memory kept on Walrus" },
];

export function viewFromHash(): View {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash.replace("#", "");
  return (VIEWS.find((v) => v.id === h)?.id ?? "overview") as View;
}

interface ShellProps {
  view: View;
  onView: (v: View) => void;
  status: StatusResponse;
  sw: SwitchStatus | null;
  counts: Partial<Record<View, number | string>>;
  ownerName: string | null;
  onLock: () => void;
  topRight: React.ReactNode;
  children: React.ReactNode;
}

export function Shell({ view, onView, status, sw, counts, ownerName, onLock, topRight, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const meta = VIEWS.find((v) => v.id === view)!;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (v: View) => {
    onView(v);
    setOpen(false);
  };

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <div className="no-print hidden w-[248px] shrink-0 border-r border-line bg-bg-2 lg:block">
        <aside className="sticky top-0 flex h-dvh">
          <Sidebar view={view} go={go} status={status} sw={sw} counts={counts} ownerName={ownerName} onLock={onLock} />
        </aside>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="absolute inset-y-0 left-0 flex w-[272px] border-r border-line bg-bg-2 animate-rise">
            <Sidebar view={view} go={go} status={status} sw={sw} counts={counts} ownerName={ownerName} onLock={onLock} />
            <button type="button" className="icon-btn absolute top-4 -right-12" onClick={() => setOpen(false)} aria-label="Close menu">
              <X />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[0.95rem] font-semibold tracking-[-0.01em]">{meta.title}</h1>
              <p className="hidden truncate text-[0.75rem] text-fg-3 sm:block">{meta.sub}</p>
            </div>
            {topRight}
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ view, go, status, sw, counts, ownerName, onLock }: { view: View; go: (v: View) => void } & Omit<ShellProps, "view" | "onView" | "topRight" | "children">) {
  const live = status.memory.mode === "mainnet";
  return (
    <div className="flex w-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Next of Kin, home">
          <LogoMark size={26} />
          <span className="flex flex-col leading-none">
            <span className="text-[0.95rem] font-semibold tracking-[-0.02em]">Next of Kin</span>
            <span className={`mt-1 text-[0.68rem] ${live ? "text-mint" : "text-rose"}`}>{live ? "Walrus Mainnet" : "Mock memory"}</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Vault">
        <p className="px-3 pb-2 text-[0.7rem] font-medium text-fg-3">Vault</p>
        <ul className="space-y-0.5">
          {VIEWS.map((v) => {
            const active = v.id === view;
            const c = counts[v.id];
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => go(v.id)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[0.875rem] transition-colors ${active ? "bg-white/[0.06] font-medium text-fg" : "text-fg-2 hover:bg-white/[0.03] hover:text-fg"}`}
                >
                  {active && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r bg-mint" aria-hidden="true" />}
                  <v.icon className={`size-4 ${active ? "text-mint" : "text-fg-3 group-hover:text-fg-2"}`} aria-hidden="true" />
                  <span className="flex-1 text-left">{v.label}</span>
                  {c !== undefined && c !== 0 && (
                    <span className={`t-num rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold ${v.id === "agent" ? "bg-mint text-mint-ink" : "bg-white/[0.06] text-fg-2"}`}>{c}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-3 pb-2 text-[0.7rem] font-medium text-fg-3">Share and verify</p>
        <ul className="space-y-0.5">
          <ExtLink href="/heir" icon={UserRound} label="Heir view" />
          <ExtLink href="/proof" icon={ShieldCheck} label="Mainnet proof" />
        </ul>
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        <div className="card-2 space-y-2 px-3 py-2.5 text-[0.75rem]">
          <StatusRow label="Walrus memory" ok={live} value={live ? "Mainnet" : "Mock"} />
          <StatusRow label="Tatum chain" ok={status.chain.mode === "live"} value={status.chain.mode === "live" ? "Live" : status.chain.mode === "fixtures" ? "Fixtures" : "Off"} />
          <StatusRow
            label="Switch"
            ok={sw?.phase === "alive"}
            warn={sw?.phase === "overdue"}
            value={sw ? (sw.phase === "alive" ? "Sealed" : sw.phase === "overdue" ? "Overdue" : sw.phase === "released" ? "Released" : "Not set") : "…"}
          />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-mint/80 to-violet/80 text-[0.8rem] font-semibold text-bg" aria-hidden="true">
            {(ownerName?.trim()[0] ?? "Y").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium">{ownerName || "Your vault"}</span>
            <span className="block text-[0.7rem] text-fg-3">Owner</span>
          </span>
          <button type="button" className="icon-btn !size-8" onClick={onLock} aria-label="Lock the vault" title="Lock">
            <Lock />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <li>
      <Link href={href} className="group flex h-9 items-center gap-3 rounded-lg px-3 text-[0.875rem] text-fg-2 transition-colors hover:bg-white/[0.03] hover:text-fg">
        <Icon className="size-4 text-fg-3 group-hover:text-fg-2" aria-hidden="true" />
        <span className="flex-1">{label}</span>
        <ArrowUpRight className="size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </Link>
    </li>
  );
}

function StatusRow({ label, ok, warn, value }: { label: string; ok: boolean; warn?: boolean; value: string }) {
  const tone = ok ? "bg-mint" : warn ? "bg-amber" : "bg-rose";
  const text = ok ? "text-mint" : warn ? "text-amber" : "text-rose";
  return (
    <div className="flex items-center gap-2">
      <span className={`dot ${tone}`} aria-hidden="true" />
      <span className="flex-1 text-fg-3">{label}</span>
      <span className={`font-medium ${text}`}>{value}</span>
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
        <span className={`pill hidden sm:inline-flex ${overdue ? "pill-amber" : "pill-muted"}`} title={overdue ? "Grace period: released when this reaches zero" : "Time until your next check-in is due"}>
          <span className="t-num">{overdue ? `Releases in ${left}` : `Due in ${left}`}</span>
        </span>
      )}
      <button type="button" className={`btn btn-sm ${overdue || released ? "btn-primary" : "btn-secondary"}`} onClick={onClick} disabled={busy || !sw || sw.phase === "setup"}>
        <HeartPulse className={done ? "text-current" : overdue || released ? "" : "text-mint"} />
        {busy ? "Checking in…" : done ? "Checked in" : released ? "Reseal: I'm here" : "I'm still here"}
      </button>
    </div>
  );
}
