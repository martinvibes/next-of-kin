"use client";

import { useEffect, useRef, useState } from "react";
import { HeartPulse, Lock } from "lucide-react";

const STEPS = [
  {
    title: "Add the wallets you want covered",
    body: "Paste public addresses only. Tatum reads what's in them, including balances, tokens and staked SUI on Sui and Ethereum.",
  },
  {
    title: "Answer one question at a time",
    body: "Where is the key, how is it opened, who should get it. The question that protects the most money comes first. Answers are encrypted in your browser.",
  },
  {
    title: "Check in now and then",
    body: "Press “I'm still here”, or just use your wallets, since on-chain activity counts too. Miss a check-in and a grace period starts.",
  },
  {
    title: "Your heir opens a letter",
    body: "If you stay quiet past the grace period, your heir unlocks a step-by-step guide with the passphrase you gave them.",
  },
];

const DWELL = 6500;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), DWELL);
    return () => clearTimeout(t);
  }, [active, auto, inView]);

  return (
    <div ref={ref} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <ol className="flex flex-col" aria-label="Steps">
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <li key={s.title} className="relative border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
                aria-current={on ? "step" : undefined}
                aria-controls="how-panel"
                className="group flex w-full gap-4 py-5 text-left"
              >
                <span className={`t-num mt-0.5 text-[0.875rem] transition-colors ${on ? "text-fg" : "text-fg-3"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[1.0625rem] font-medium tracking-[-0.01em] transition-colors ${on ? "text-fg" : "text-fg-3 group-hover:text-fg-2"}`}>{s.title}</span>
                  <span className={`grid transition-[grid-template-rows,opacity] duration-500 ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <span className="overflow-hidden">
                      <span className="block pt-2 text-[0.9375rem] leading-relaxed text-fg-2">{s.body}</span>
                    </span>
                  </span>
                </span>
              </button>
              {on && (
                <span className="absolute top-[-1px] left-0 h-px w-full bg-fg/80">
                  <span
                    key={`${active}-${auto}-${inView}`}
                    className="absolute inset-0 origin-left bg-ember"
                    style={auto && inView ? { animation: `grow-x ${DWELL}ms linear both` } : { transform: "scaleX(1)" }}
                    aria-hidden="true"
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div id="how-panel" className="sunk relative flex min-h-[380px] items-center justify-center overflow-hidden p-5 sm:p-10" aria-live="polite">
        <span className="pill absolute top-4 right-4 bg-panel text-fg-3 shadow-[var(--shadow-soft)]">Example</span>
        <div key={active} className="w-full max-w-[440px] animate-rise">
          {active === 0 && <WalletsDemo />}
          {active === 1 && <QuestionDemo />}
          {active === 2 && <CheckinDemo />}
          {active === 3 && <LetterDemo />}
        </div>
      </div>
    </div>
  );
}

function Row({ sym, name, amt, usd, tag }: { sym: string; name: string; amt: string; usd: string; tag?: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-8 place-items-center rounded-full bg-bg-2 text-[0.7rem] font-semibold text-fg-2">{sym.slice(0, 3)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[0.875rem] font-medium">
          {name} {tag && <span className="pill pill-muted !h-5">{tag}</span>}
        </span>
        <span className="t-num block text-[0.78rem] text-fg-3">{amt}</span>
      </span>
      <span className="t-num text-[0.875rem] font-medium">{usd}</span>
    </li>
  );
}

function WalletsDemo() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-[0.875rem] font-medium">Savings</span>
        <span className="t-mono text-[0.75rem] text-fg-3">0x7a3f…c21e · Sui</span>
      </div>
      <ul className="divide-y divide-line">
        <Row sym="SUI" name="SUI" tag="Staked" amt="412.00 SUI" usd="$1,236" />
        <Row sym="USDC" name="USD Coin" amt="1,250.00 USDC" usd="$1,250" />
        <Row sym="WAL" name="Walrus" amt="3,100 WAL" usd="$1,488" />
      </ul>
      <div className="flex items-center justify-between border-t border-line bg-panel-2 px-4 py-3 text-[0.8125rem]">
        <span className="text-fg-3">Read through Tatum</span>
        <span className="t-num font-semibold">$3,974</span>
      </div>
    </div>
  );
}

function QuestionDemo() {
  const [score, setScore] = useState(58);
  useEffect(() => {
    const t = setTimeout(() => setScore(72), 1400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-3">
      <div className="card p-5">
        <p className="text-[0.8125rem] text-fg-3">Next question · protects $1,236</p>
        <p className="mt-1.5 text-[1.0625rem] leading-snug font-medium">How would someone open the staked SUI in Savings?</p>
        <div className="mt-4 rounded-lg border border-line-2 bg-panel px-3.5 py-3 text-[0.875rem] leading-relaxed text-fg-2">Open Slush on the phone in my desk, go to Staking and withdraw. It arrives the next day.</div>
        <p className="mt-3 flex items-center gap-1.5 text-[0.78rem] text-fg-3">
          <Lock className="size-3.5" aria-hidden="true" /> Encrypted in your browser before it&rsquo;s saved
        </p>
      </div>
      <div className="card flex items-center gap-4 px-5 py-4">
        <span className="text-[0.875rem] text-fg-2">Readiness</span>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg-2">
          <span className="absolute inset-y-0 left-0 rounded-full bg-fg transition-[width] duration-1000 ease-out" style={{ width: `${score}%` }} />
        </span>
        <span className="t-num w-10 text-right text-[0.9375rem] font-semibold">{score}%</span>
      </div>
    </div>
  );
}

function CheckinDemo() {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[0.875rem] font-medium">
          <span className="dot bg-ember animate-beat" aria-hidden="true" /> Sealed
        </span>
        <span className="t-num text-[0.875rem] text-fg-2">Next check-in in 6 days</span>
      </div>
      <svg viewBox="0 0 400 60" className="mt-5 h-[60px] w-full" aria-hidden="true">
        <path d="M0 36 H70 l6 -20 l7 36 l6 -22 H190 l6 -20 l7 36 l6 -22 H300" fill="none" stroke="#191816" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M300 36 H400" fill="none" stroke="#99958d" strokeWidth="1.4" strokeDasharray="3 5" />
        <circle cx="300" cy="36" r="4" fill="#ff5b14" />
      </svg>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[0.8125rem] text-fg-3">Moving funds on Sui counts as a check-in.</span>
        <span className="btn btn-primary btn-sm pointer-events-none" aria-hidden="true">
          <HeartPulse /> I&rsquo;m still here
        </span>
      </div>
    </div>
  );
}

function LetterDemo() {
  return (
    <div className="paper px-7 py-7">
      <p className="t-letter text-[1.25rem] font-medium">For Ada,</p>
      <p className="t-letter mt-2 text-[1rem] text-[#3a3631]">Everything is where I said it would be. Take your time with this, and don&rsquo;t let anyone rush you.</p>
      <ol className="mt-5 space-y-2.5 border-t border-[#e9e4da] pt-4 text-[0.875rem] text-[#3a3631]">
        <li className="flex gap-3">
          <span className="t-num text-[#99958d]">1</span> Open Slush on the phone in the desk drawer.
        </li>
        <li className="flex gap-3">
          <span className="t-num text-[#99958d]">2</span> Withdraw the staked SUI. It arrives the next day.
        </li>
        <li className="flex gap-3">
          <span className="t-num text-[#99958d]">3</span> Split it equally with Theo.
        </li>
      </ol>
      <p className="mt-5 text-right font-[family-name:var(--font-hand)] text-[2rem] leading-none text-[#2a2723]">Martin</p>
    </div>
  );
}
