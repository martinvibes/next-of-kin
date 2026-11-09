"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Ban, ChevronDown, Database, EyeOff, Hourglass, KeyRound } from "lucide-react";
import { Reveal, SplitText, useInView } from "@/components/motion/Reveal";
import { AnswerMock, CheckinMock, HandoverMock, WalletsMock } from "./Mocks";

/* ── Roots: the dark band, then the four steps in a framed grid ─── */

function Cell({ wash, title, body, children, className = "", mock = "", delay = 0, row }: { wash: string; title: string; body: React.ReactNode; children: React.ReactNode; className?: string; mock?: string; delay?: number; row?: boolean }) {
  return (
    <Reveal delay={delay} className={`relative flex min-w-0 overflow-hidden ${row ? "flex-col lg:flex-row" : "flex-col"} ${wash} ${className}`}>
      <div className={`shrink-0 p-6 sm:p-8 ${row ? "lg:w-[416px]" : ""}`}>
        <h3 className="text-[22px] leading-7 font-medium tracking-[-0.02em]">{title}</h3>
        <p className="mt-1.5 max-w-[46ch] text-[14px] leading-5 text-fg-2">{body}</p>
      </div>
      <div className={`relative min-h-0 flex-1 basis-auto ${mock}`}>
        <div className={`absolute inset-x-6 bottom-0 overflow-hidden rounded-t-lg border border-b-0 border-line bg-white shadow-[0_1px_2px_rgba(12,9,12,0.03)] sm:inset-x-8 ${row ? "top-0 lg:top-8 lg:left-0" : "top-0"}`}>{children}</div>
      </div>
    </Reveal>
  );
}

export function Roots() {
  const band = useRef<HTMLDivElement>(null);
  const { ref, inView } = useInView<HTMLDivElement>({ margin: "0px 0px -20% 0px" });

  // The roots drift up as you scroll past, the opposite way to the tree above.
  useEffect(() => {
    const el = band.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.parentElement!.getBoundingClientRect();
        const p = Math.max(-1, Math.min(1, r.top / window.innerHeight));
        el.style.transform = `translate3d(0, ${p * 90}px, 0) scaleY(-1)`;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="how" className="relative isolate scroll-mt-0" aria-labelledby="roots-title">
      {/* The dark band runs on behind the top of the grid and fades into the page. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden sm:h-[1000px] lg:h-[1060px] bg-[#0a0a0a] [mask-image:linear-gradient(to_bottom,#000_calc(100%-28rem),transparent)]" aria-hidden="true">
        <div className="absolute inset-x-0 -top-[10%] h-[85%]">
          <div ref={band} className="absolute inset-0 [transform:scaleY(-1)]">
            <Image src="/scene/tree.webp" alt="" fill sizes="100vw" className="object-cover object-[68%_100%] opacity-80 blur-[2px] brightness-[0.62] contrast-[1.25] saturate-[0.9]" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#0a0a0a,rgba(10,10,10,0.2)_28%,rgba(10,10,10,0.35)_70%,#0a0a0a)]" />
        </div>
        <div className="grain absolute inset-0 opacity-25 mix-blend-overlay" />
        {/* frame lines rising out of the grid */}
        <div className="absolute inset-y-0 left-1/2 hidden w-full max-w-[1200px] -translate-x-1/2 border-x border-white/10 lg:block" />
      </div>

      <div ref={ref} className={`mx-auto flex max-w-[768px] flex-col items-center gap-4 px-6 pt-20 pb-24 text-center sm:px-8 sm:pt-28 sm:pb-32 ${inView ? "is-in" : ""}`}>
        <h2 id="roots-title" className="text-[32px] leading-[1.12] font-medium tracking-[-0.04em] text-balance text-white sm:text-[40px] lg:text-[56px]">
          {"Every family tree has roots nobody can see.".split(" ").map((w, i, a) => (
            <span key={i}>
              <span className="split-w">
                <span style={{ "--i": i } as React.CSSProperties}>{w}</span>
              </span>
              {i < a.length - 1 ? " " : null}
            </span>
          ))}
        </h2>
        <p className="max-w-[576px] text-[16px] leading-7 text-white/70">
          <span className={`block transition-all duration-700 ${inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`} style={{ transitionDelay: "450ms" }}>
            Your parents left a will and a filing cabinet.
          </span>
          <span className={`block transition-all duration-700 ${inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`} style={{ transitionDelay: "650ms" }}>
            You&rsquo;ll need to leave directions to your keys.
          </span>
        </p>
      </div>

      <div className="relative mx-4 max-w-[1200px] border-x border-line bg-bg sm:mx-6 xl:mx-auto">
        <span className="plus top-0 left-0" />
        <span className="plus top-0 left-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <Cell
            row
            wash="wash-green"
            className="lg:col-span-3 lg:h-[352px]"
            mock="h-[300px] lg:h-auto lg:pr-0"
            title="Map every wallet you own"
            body="Paste public addresses on Sui or Ethereum. Next of Kin reads balances, tokens and stakes through Tatum. It never asks for keys."
          >
            <WalletsMock />
          </Cell>

          <div className="grid min-w-0 grid-cols-1 lg:col-span-2 lg:grid-rows-2">
            <Cell wash="wash-red" className="border-t border-line lg:h-[441px]" mock="h-[300px] lg:h-auto" delay={60} title="Answer a few plain questions" body="Where the key is, how to open it, who should get it. Each answer is encrypted in your browser before it leaves.">
              <AnswerMock />
            </Cell>
            <Cell wash="wash-blue" className="border-t border-line lg:h-[441px]" mock="h-[300px] lg:h-auto" delay={60} title="Prove you're still here" body="Check in with one tap, or just use your wallets. Any transaction they make counts as a sign of life.">
              <CheckinMock />
            </Cell>
          </div>

          <Cell
            wash="wash-orange"
            className="border-t border-line lg:row-span-1 lg:h-[882px] lg:border-l"
            mock="h-[560px] lg:h-auto"
            delay={140}
            title="Hand it over when it's time"
            body={
              <>
                If you stop checking in and the grace period runs out, your heir opens a letter with <span className="text-fg">everything they need</span>.
              </>
            }
          >
            <HandoverMock />
          </Cell>
        </div>
        <span className="plus top-[352px] left-0 hidden lg:block" />
        <span className="plus top-[352px] left-2/3 hidden lg:block" />
        <span className="plus top-[352px] left-full hidden lg:block" />
        <span className="plus top-full left-0" />
        <span className="plus top-full left-2/3 hidden lg:block" />
        <span className="plus top-full left-full" />
        <div className="absolute top-full left-0 hidden h-16 w-full border-x border-line [mask-image:linear-gradient(to_bottom,#000,transparent)] lg:block" aria-hidden="true" />
      </div>
    </section>
  );
}

/* ── What it never does: a ticker of promises ─────────── */

const PROMISES = [
  { icon: KeyRound, t: "Never asks for a recovery phrase", b: "Only public addresses. A phrase or private key pasted anywhere is refused in your browser and again on the server." },
  { icon: EyeOff, t: "Never reads your answers", b: "Everything you write is encrypted with your passphrase before it's sent. The server only ever holds ciphertext." },
  { icon: Ban, t: "Never moves your money", b: "It reads public balances through Tatum. With no keys it has nothing to sign with." },
  { icon: Hourglass, t: "Never opens early", b: "A missed check-in starts a grace period, and any transaction from your wallets keeps the vault sealed." },
  { icon: Database, t: "Never depends on this server", b: "Every memory lives on Walrus Mainnet. Wipe the server and the vault rebuilds from memory." },
];

const BADGE = "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z";

function Badge({ icon: Icon, on = true, size = 32 }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; on?: boolean; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className={`absolute inset-0 size-full transition-colors duration-500 ${on ? "text-blue" : "text-[#d9d6d9]"}`} aria-hidden="true">
        <path d={BADGE} fill="currentColor" />
      </svg>
      <Icon className="relative size-[45%] text-white" strokeWidth={2.6} />
    </span>
  );
}

const CARD = 280;

export function Promises() {
  const n = PROMISES.length;
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, margin: "0px" });
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!inView || hover) return;
    const id = setInterval(() => setPos((p) => p + 1), 2800);
    return () => clearInterval(id);
  }, [inView, hover]);

  // After stepping past the first copy, jump back without animating so the loop is seamless.
  useEffect(() => {
    if (pos < n) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setPos((p) => p - n);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    }, 950);
    return () => clearTimeout(t);
  }, [pos, n]);

  const active = (pos + 1) % n;
  const cards = [...PROMISES, ...PROMISES, ...PROMISES.slice(0, 3)];

  return (
    <section id="promises" className="flex w-full flex-col items-center gap-12 px-6 py-20 sm:px-8" aria-labelledby="promises-title">
      <div className="flex max-w-[560px] flex-col items-center gap-3 text-center">
        <SplitText id="promises-title" text="It never touches your keys" className="t-display text-[32px] leading-9 font-semibold text-[#0a0a0a] sm:text-[36px]" />
        <Reveal as="p" delay={200} className="text-[14px] leading-5 text-[#737373]">
          Five things the code refuses to do, whoever runs the server.
        </Reveal>
      </div>

      <Reveal delay={150} className="relative w-full max-w-[840px]">
        <span className="plus top-0 left-0" />
        <span className="plus top-0 left-full" />
        <span className="plus top-full left-0" />
        <span className="plus top-full left-full" />
        <div className="pointer-events-none absolute -top-16 bottom-[-4rem] left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--color-line)_25%,var(--color-line)_75%,transparent)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-16 right-0 bottom-[-4rem] w-px bg-[linear-gradient(to_bottom,transparent,var(--color-line)_25%,var(--color-line)_75%,transparent)]" aria-hidden="true" />
        <div ref={ref} className="overflow-hidden border-y border-line [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
          <ul
            className="m-0 flex w-max list-none p-0"
            style={{
              transform: `translate3d(calc(${-pos * CARD}px + (min(100vw - 48px, 840px) - ${3 * CARD}px) / 2), 0, 0)`,
              transition: animate ? "transform 0.9s var(--ease-out)" : "none",
            }}
          >
            {cards.map((p, i) => {
              const on = i % n === active && i >= pos && i <= pos + 2;
              return (
                <li key={i} className="flex shrink-0 flex-col gap-4 border-r border-line p-6 sm:p-8" style={{ width: CARD }} aria-hidden={i >= n ? true : undefined}>
                  <span className={`transition-opacity duration-300 ${on ? "opacity-100" : "opacity-60"}`}>
                    <Badge icon={p.icon} on={on} />
                  </span>
                  <span className={`flex flex-col gap-1 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-60"}`}>
                    <span className="text-[14px] leading-5 font-medium">{p.t}</span>
                    <span className="text-[14px] leading-5 text-fg-2">{p.b}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Reveal>

      <div className="flex items-center gap-3" role="tablist" aria-label="Promises">
        {PROMISES.map((p, i) => (
          <button key={p.t} type="button" role="tab" aria-selected={i === active} aria-label={p.t} onClick={() => setPos(i === 0 ? n - 1 : i - 1)} className="rounded-full transition-transform hover:scale-110">
            <Badge icon={p.icon} on={i === active} size={28} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Built on: two framed stories ─────────────────────── */

const STACK = [
  {
    mark: "W",
    label: "Walrus Mainnet",
    title: "Every answer is a memory on Walrus",
    body: "Answers, check-ins and readiness changes are written as encrypted memories on Walrus Mainnet. The server is only a cache: wipe it and the vault rebuilds from memory.",
    href: "/proof",
    cta: "Check every memory",
  },
  {
    mark: "T",
    label: "Tatum",
    title: "Balances come from the chain, not from you",
    body: "Balances, tokens, stakes and recent transactions on Sui and Ethereum are read through Tatum on the server, so the API key never reaches a browser.",
    href: "/proof",
    cta: "See what it reads",
  },
];

export function BuiltOn() {
  return (
    <section id="built-on" className="flex w-full flex-col items-center gap-12 px-6 py-20 sm:px-8" aria-labelledby="built-title">
      <SplitText id="built-title" text="Built on open infrastructure" className="t-display text-center text-[32px] leading-9 font-semibold text-[#0a0a0a] sm:text-[36px]" />
      <div className="relative w-full max-w-[840px]">
        <span className="plus top-0 left-0" />
        <span className="plus top-0 left-1/2 hidden lg:block" />
        <span className="plus top-0 left-full" />
        <span className="plus top-full left-0" />
        <span className="plus top-full left-1/2 hidden lg:block" />
        <span className="plus top-full left-full" />
        <div className="pointer-events-none absolute -top-14 bottom-[-3.5rem] left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--color-line)_25%,var(--color-line)_75%,transparent)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-14 right-0 bottom-[-3.5rem] w-px bg-[linear-gradient(to_bottom,transparent,var(--color-line)_25%,var(--color-line)_75%,transparent)]" aria-hidden="true" />
        <div className="grid border-y border-line lg:grid-cols-2">
          {STACK.map((s, i) => (
            <Reveal key={s.label} delay={i * 120} className={`flex flex-col ${i > 0 ? "border-t border-line lg:border-t-0 lg:border-l" : ""}`}>
              <div className="flex flex-col gap-4 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="t-display grid size-8 place-items-center border border-line bg-white text-[18px] leading-none">{s.mark}</span>
                  <span className="t-mono text-[12px] font-medium tracking-wider text-[#737373] uppercase">{s.label}</span>
                </div>
                <h3 className="max-w-[22ch] text-[22px] leading-7 font-medium tracking-[-0.02em]">{s.title}</h3>
                <p className="text-[14px] leading-5 text-fg-2">{s.body}</p>
              </div>
              <div className="mt-auto border-t border-dashed border-line px-6 py-6 sm:px-8">
                <Link href={s.href} className="group t-mono inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wider text-[#737373] uppercase transition-colors hover:text-fg">
                  {s.cta}
                  <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────── */

const FAQ = [
  {
    q: "Do I have to give you my recovery phrase?",
    a: "No, and you can't. Next of Kin only asks for public wallet addresses. Your answers describe where things are (“the sheet is in the fireproof box”), never the secret itself. If something that looks like a recovery phrase or private key is pasted in, it's refused.",
  },
  { q: "What does my heir need to open it?", a: "Two things: the link to this app and the passphrase you chose at setup. Tell them where to find the passphrase, the same way you'd tell them where your will is." },
  {
    q: "What if I just forget to check in?",
    a: "A missed check-in starts a grace period, not a release. Any transaction from your wallets also counts as a sign of life, so ordinary use keeps the vault sealed. In this demo the interval is minutes, so you can watch it work.",
  },
  { q: "Where is my information kept?", a: "As encrypted memories on Walrus Mainnet. If this server were wiped, the whole vault could be rebuilt from Walrus. The Proof page lets you check every memory yourself." },
  { q: "Can the people running this server read my answers?", a: "No. Answers, labels and your letter are encrypted in your browser with a key made from your passphrase. The server and Walrus only ever see ciphertext." },
  { q: "Is this legal or financial advice?", a: "No. It's a way to make sure the practical knowledge reaches the right person. It works alongside a will, not instead of one." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="flex w-full flex-col items-center gap-12 px-6 pt-20 pb-32 sm:px-8 sm:pb-40" aria-labelledby="faq-title">
      <SplitText id="faq-title" text="Frequently asked questions" className="t-display text-center text-[32px] leading-9 font-semibold text-[#0a0a0a] sm:text-[36px]" />
      <div className="flex w-full max-w-[768px] flex-col">
        {FAQ.map((f, i) => {
          const on = open === i;
          return (
            <Reveal key={f.q} delay={i * 60} className="border-line not-last:border-b">
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`faq-${i}`} onClick={() => setOpen(on ? null : i)} className="flex w-full items-start justify-between gap-6 py-5 text-left text-[16px] leading-6 font-medium">
                  {f.q}
                  <ChevronDown className={`mt-1 size-4 shrink-0 text-fg-2 transition-transform duration-500 ${on ? "rotate-180" : ""}`} />
                </button>
              </h3>
              <div id={`faq-${i}`} role="region" className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <p className="max-w-[44rem] pb-6 text-[15px] leading-relaxed text-fg-2">{f.a}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
