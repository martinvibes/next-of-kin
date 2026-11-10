"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";
export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface Item {
  id: number;
  kind: Kind;
  title: string;
  detail?: string;
  action?: ToastAction;
}

// ─── Store ──────────────────────────────────────────────────────────────────
// Module-level so any component (or plain function) can raise a toast without
// a provider. Newest first; at most three on screen.

const MAX = 3;
const EMPTY: Item[] = [];
let items: Item[] = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function push(kind: Kind, title: string, detail?: string, action?: ToastAction): number {
  const id = ++seq;
  const clean = detail?.replace(/\s+/g, " ").trim() || undefined;
  // The same message twice in a row replaces itself instead of stacking.
  const rest = items.filter((t) => !(t.kind === kind && t.title === title && t.detail === clean));
  items = [{ id, kind, title, detail: clean, action }, ...rest].slice(0, MAX);
  emit();
  return id;
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, detail?: string) => push("success", title, detail),
  error: (title: string, detail?: string, action?: ToastAction) => push("error", title, detail, action),
  info: (title: string, detail?: string) => push("info", title, detail),
  dismiss,
};

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ─── View ───────────────────────────────────────────────────────────────────

const LIFETIME: Record<Kind, number> = { success: 4000, info: 4000, error: 8000 };

const ICON: Record<Kind, { Icon: typeof Info; tone: string }> = {
  success: { Icon: CheckCircle2, tone: "text-[#4ade80]" },
  error: { Icon: CircleAlert, tone: "text-[#fb7185]" },
  info: { Icon: Info, tone: "text-white/80" },
};

function ToastCard({ t }: { t: Item }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const left = useRef(LIFETIME[t.kind]);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(t.id), Math.max(left.current, 600));
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [paused, t.id]);

  const { Icon, tone } = ICON[t.kind];
  return (
    <div
      role={t.kind === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-fg py-3 pr-2.5 pl-3 text-white shadow-[var(--shadow-pop)] animate-rise"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
        <Icon className={`size-4 ${tone}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-[0.875rem] leading-5 font-semibold">{t.title}</p>
        {t.detail && <p className="mt-0.5 text-[0.8125rem] leading-[1.45] text-white/65">{t.detail}</p>}
        {t.action && (
          <button
            type="button"
            className="mt-2 inline-flex h-7 cursor-pointer items-center rounded-lg bg-white/12 px-2.5 text-[0.8125rem] font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => {
              dismiss(t.id);
              t.action?.onClick();
            }}
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Mount once, in the root layout. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="no-print pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2"
    >
      {list.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </section>
  );
}
