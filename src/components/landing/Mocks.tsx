"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BadgeCheck, ChevronRight, CircleCheck, CloudUpload, HeartPulse, Lock, RotateCcw, TrendingUp, User, Wallet } from "lucide-react";
import { useInView } from "@/components/motion/Reveal";

/** Illustrations of the product. Nothing here is real data, and each one says so. */
function Example({ className = "" }: { className?: string }) {
  return <span className={`text-[11px] text-fg-3 ${className}`}>Example</span>;
}

function useTicker(active: boolean, ms: number, n: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(id);
  }, [active, ms, n]);
  return i;
}

/* ── Wallets ──────────────────────────────────────────── */

const WALLET_TABS = [
  {
    id: "sui",
    label: "Sui",
    items: [
      { n: "SUI", s: "Main wallet" },
      { n: "Staked SUI", s: "Needs its own answer" },
      { n: "USDC", s: "Main wallet" },
      { n: "WAL", s: "Main wallet" },
      { n: "DEEP", s: "Phone wallet" },
      { n: "SUI", s: "Phone wallet" },
    ],
  },
  {
    id: "eth",
    label: "Ethereum",
    items: [
      { n: "ETH", s: "Ledger" },
      { n: "USDC", s: "Ledger" },
      { n: "stETH", s: "Ledger" },
      { n: "ETH", s: "Browser wallet" },
      { n: "DAI", s: "Browser wallet" },
      { n: "LINK", s: "Browser wallet" },
    ],
  },
  { id: "add", label: "Add address", items: [] },
] as const;

function CoinTile({ n, s, on }: { n: string; s: string; on: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-md border p-2 transition-colors duration-500 ${on ? "border-[#bfe5cc] bg-[#f1faf4]" : "border-line bg-white"}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-[#d3eedb] bg-[#eef8f1] text-[10px] font-semibold text-[#15803d]">{n.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}</span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] leading-4 font-medium text-fg">{n}</span>
        <span className="block truncate text-[11px] leading-4 text-fg-2">{s}</span>
      </span>
    </div>
  );
}

export function WalletsMock() {
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const tab = useTicker(inView, 4200, WALLET_TABS.length);
  const hi = useTicker(inView, 1100, 6);
  const t = WALLET_TABS[tab];
  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <Wallet className="size-4 text-[#15803d]" /> Wallets
        </span>
        <span className="flex items-center gap-3">
          <Example className="hidden sm:inline" />
          <span className="flex rounded-lg bg-bg-2 p-0.5">
            {WALLET_TABS.map((w, i) => (
              <span key={w.id} className={`flex h-6 items-center rounded-[5px] px-2 text-[12px] font-medium whitespace-nowrap transition-all duration-300 ${i === tab ? "bg-white text-fg shadow-[0_1px_2px_rgba(12,9,12,0.08),0_0_0_1px_rgba(12,9,12,0.06)]" : "text-fg-2"}`}>
                {w.label}
              </span>
            ))}
          </span>
        </span>
      </div>
      <div key={t.id} className="min-h-0 flex-1 p-4 view-enter">
        {t.id === "add" ? (
          <div className="space-y-2">
            <div className="flex h-9 items-center gap-2.5 rounded-md border border-dashed border-line-2 px-3">
              <Wallet className="size-3.5 text-fg-2" />
              <span className="t-mono text-[12px]">0x8f3c…a12e</span>
              <span className="ml-auto text-[11px] text-fg-2">Reading balances via Tatum</span>
              <span className="h-1 w-24 overflow-hidden rounded-full bg-bg-2">
                <span className="block h-full w-full origin-left rounded-full bg-[#16a34a] [animation:grow-x_3.6s_var(--ease-out)_both]" />
              </span>
            </div>
            {[62, 48, 70, 40].map((w, i) => (
              <div key={i} className="flex h-8 items-center gap-3 rounded-md border border-line px-3 opacity-0 [animation:slideRow_0.6s_var(--ease-out)_both]" style={{ animationDelay: `${600 + i * 450}ms` }}>
                <span className="size-1.5 rounded-full bg-[#16a34a]" />
                <span className="h-2 rounded-full bg-[#ececec]" style={{ width: `${w}%` }} />
                <span className="ml-auto h-2 w-12 rounded-full bg-[#f1f1f1]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {t.items.map((c, i) => (
              <CoinTile key={c.n + c.s} n={c.n} s={c.s} on={i === hi} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Questions ────────────────────────────────────────── */

const ANSWER = "In the fireproof box in the hall cupboard. Ada knows where the key is.";

export function AnswerMock() {
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [n, setN] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= ANSWER.length) clearInterval(id);
    }, 38);
    const again = setTimeout(() => setRound((r) => r + 1), ANSWER.length * 38 + 5200);
    return () => {
      clearInterval(id);
      clearTimeout(again);
    };
  }, [inView, round]);
  const done = n >= ANSWER.length;
  const rows = [
    { icon: Lock, t: "encrypt(answer)  AES-GCM, in this browser" },
    { icon: CloudUpload, t: "remember  Walrus Mainnet" },
    { icon: TrendingUp, t: "readiness  58% → 72%" },
  ];
  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-4">
        <span className="flex items-center gap-3">
          <span className="h-2.5 w-16 rounded-full bg-[#ececec] sm:w-36" />
          <Example className="hidden sm:inline" />
        </span>
        <span className={`flex h-8 shrink-0 items-center gap-2 rounded-xl bg-black pr-3 pl-1.5 text-[13px] font-medium whitespace-nowrap text-[#f7f7f7] transition-transform duration-300 ${done ? "scale-[0.97]" : ""}`}>
          <span className="grid size-5 place-items-center rounded-full bg-ember">
            <Lock className="size-3 text-white" />
          </span>
          Encrypt &amp; save
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 p-4">
        <div className="ml-auto w-[min(26rem,78%)] rounded-lg bg-bg-2 px-3 py-2.5 text-[12.5px] leading-[1.45] text-fg">Where is the recovery sheet for the Ledger kept?</div>
        <p className={`min-h-[2.6em] max-w-[34rem] text-[12.5px] leading-[1.45] text-fg ${done ? "" : "caret"}`}>{ANSWER.slice(0, n)}</p>
        <div className="space-y-1.5 pt-1">
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <div
                key={r.t}
                className={`flex h-8 max-w-[34rem] items-center gap-2 rounded-md bg-[#f6f5f6] px-2.5 text-[12px] transition-all duration-500 ${done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
                style={{ transitionDelay: done ? `${250 + i * 380}ms` : "0ms" }}
              >
                <ChevronRight className="size-3 text-fg-3" />
                <Icon className="size-3.5 text-fg-2" />
                <span className="t-mono truncate">{r.t}</span>
              </div>
            );
          })}
        </div>
        <div className="space-y-2 pt-2">
          <span className="block h-2 w-[64%] rounded-full bg-[#ececec]" />
          <span className="block h-2 w-[44%] rounded-full bg-[#f1f1f1]" />
        </div>
      </div>
    </div>
  );
}

/* ── Proof of life ────────────────────────────────────── */

const SIGNS = [
  { icon: "check", t: "Checked in", w: "today", on: true },
  { icon: "tx", t: "Sui transaction", w: "2d" },
  { icon: "tx", t: "Ethereum transaction", w: "9d" },
  { icon: "check", t: "Checked in", w: "31d" },
  { icon: "due", t: "Next check-in due", w: "in 30d" },
] as const;

function SignIcon({ k }: { k: "check" | "tx" | "due" }) {
  if (k === "check") return <BadgeCheck className="size-4 fill-blue text-white" />;
  if (k === "tx") return <CircleCheck className="size-4 fill-[#16a34a] text-white" />;
  return (
    <span className="relative grid size-4 place-items-center rounded-full border-2 border-ember">
      <span className="absolute inset-[2px] rounded-full bg-[conic-gradient(var(--color-ember)_0_35%,transparent_35%)]" />
    </span>
  );
}

export function CheckinMock() {
  const { ref, inView } = useInView<HTMLDivElement>({ margin: "0px" });
  const steps = [
    { icon: HeartPulse, tone: "text-ember", who: "You", t: "checked in" },
    { icon: RotateCcw, tone: "text-fg-2", who: "Timer", t: "reset to 30 days" },
    { icon: BadgeCheck, tone: "text-blue", who: "Vault", t: "stays sealed" },
  ];
  return (
    <div ref={ref} className="grid h-full grid-cols-1 sm:grid-cols-[2fr_3fr]">
      <div className="hidden flex-col gap-1 border-r border-line p-3 sm:flex">
        <span className="flex h-7 items-center gap-1 px-2 text-[11px] text-fg-2">
          Signs of life in <HeartPulse className="ml-1 size-3 text-ember" /> <span className="font-medium text-ember">Your vault</span>
        </span>
        {SIGNS.map((s, i) => (
          <div
            key={i}
            className={`flex h-9 items-center gap-2 rounded-md border px-2 text-[12.5px] transition-all duration-700 ${"on" in s && s.on ? "border-[#cfe0fd] bg-[#f3f7ff]" : "border-transparent"} ${inView ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`}
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            <SignIcon k={s.icon} />
            <span className="truncate">{s.t}</span>
            <span className="ml-auto shrink-0 text-[11px] text-fg-2">{s.w}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium">Checked in</span>
          <span className="text-[13px] text-fg-2">today</span>
          <span className="pill pill-blue h-[22px] rounded-full border-[#cfe0fd]">
            <BadgeCheck /> Verified
          </span>
          <Example className="ml-auto" />
        </div>
        <div className="rounded-lg border border-line p-3">
          <span className="flex items-center gap-2 text-[12.5px] font-medium">
            <span className="grid size-5 place-items-center rounded-full bg-[#8974d3] text-white">
              <User className="size-3" />
            </span>
            Tatum
          </span>
          <p className="mt-1.5 text-[12px] leading-[1.45] text-fg-2">Saw a transaction from 0x7a…3f on Sui two days ago. That counts as a sign of life too.</p>
        </div>
        <ol className="relative space-y-2.5 pl-1">
          <span className="absolute top-2 bottom-2 left-[9px] w-px bg-line" aria-hidden="true" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.t} className={`relative flex items-center gap-2.5 text-[12px] transition-all duration-700 ${inView ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`} style={{ transitionDelay: `${500 + i * 260}ms` }}>
                <span className="relative grid size-[18px] place-items-center rounded-full bg-white">
                  <Icon className={`size-3.5 ${s.tone}`} />
                  {i === 0 && <span className="absolute inset-0 animate-beat rounded-full" />}
                </span>
                <span>
                  <span className="font-medium">{s.who}</span> <span className="text-fg-2">{s.t}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ── The hand-over ────────────────────────────────────── */

const BARS = [3, 4, 6, 9, 14, 20, 17, 27, 31, 44, 52, 64];
const DELTAS = ["+14%", "+9%", "+6%", "+11%", "+5%", "+8%", "+3%", "+7%"];

export function HandoverMock() {
  const { ref, inView } = useInView<HTMLDivElement>({ margin: "0px" });
  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full bg-[#e2e2e2]" />
          ))}
        </span>
        <span className="mx-auto flex h-5 items-center gap-1.5 rounded-md bg-bg-2 px-3 text-[11px] text-fg-2">
          <Lock className="size-2.5" /> next of kin / heir
        </span>
        <Example />
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="t-display text-[16px] tracking-[-0.04em]">Next of Kin</span>
        <span className="flex gap-2">
          <span className="h-2 w-10 rounded-full bg-[#ececec]" />
          <span className="h-2 w-10 rounded-full bg-[#ececec]" />
        </span>
      </div>
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-fg-2">Ada could recover</span>
          <span className="text-[28px] leading-8 font-medium tracking-[-0.03em] tabular-nums">$41,280</span>
        </div>
        <span className="flex h-6 items-center gap-1 rounded-full bg-ember-wash px-2 text-[12px] font-medium text-[#e05a00]">
          <ArrowUpRight className="size-3" /> 72% ready
        </span>
      </div>
      <div className="flex h-[120px] shrink-0 items-end gap-[3px] border-b border-line px-4 sm:h-[128px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`flex-1 origin-bottom rounded-t-[2px] ${i >= BARS.length - 3 ? "bg-ember" : "bg-[#ffd9bf]"}`}
            style={{ height: `${(h / 64) * 100}%`, transform: inView ? "scaleY(1)" : "scaleY(0)", transition: `transform 1s var(--ease-out) ${200 + i * 60}ms` }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-[12px] text-fg-2">Memories written</span>
        <span className="h-2 w-10 rounded-full bg-[#ececec]" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {DELTAS.map((d, i) => (
          <div
            key={i}
            className={`flex h-12 items-center gap-3 border-t border-line px-4 transition-all duration-700 ${inView ? "translate-y-0" : "translate-y-3 opacity-0"} ${i === 0 ? "opacity-50" : inView ? "opacity-100" : ""}`}
            style={{ transitionDelay: `${700 + i * 110}ms` }}
          >
            <span className="grid size-5 place-items-center rounded-full bg-ember-wash">
              <span className="size-1.5 rounded-full bg-ember" />
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="h-2 rounded-full bg-[#ececec]" style={{ width: `${70 + ((i * 37) % 60)}px` }} />
              <span className="h-1.5 w-12 rounded-full bg-[#f1f1f1]" />
            </span>
            <span className="ml-auto text-[14px] font-medium text-[#e05a00] tabular-nums">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
