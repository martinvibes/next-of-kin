import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { StatusBanner } from "@/components/StatusBanner";
import { Pulse } from "@/components/landing/Pulse";
import { LiveStats } from "@/components/landing/LiveStats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Odometer } from "@/components/ui/Odometer";

const UNKNOWNS = ["Which wallets exist, and on which chains", "That the SUI is staked and has to be withdrawn first", "Where the phone or hardware wallet is kept", "Who it was all meant for"];

const NEVER = [
  { t: "Ask for your recovery phrase", b: "It only needs public addresses. If a phrase or private key is ever pasted in, it's refused in your browser and again on the server." },
  { t: "Read your answers", b: "Everything you write is encrypted in your browser with your passphrase before it's sent. The server stores ciphertext." },
  { t: "Move your money", b: "It reads public balances through Tatum. It has no keys, so it can't sign anything." },
  { t: "Open early", b: "Your heir sees nothing until you've missed a check-in, the grace period has run out, and your wallets have gone quiet on-chain." },
];

const FAQ = [
  {
    q: "Do I have to give you my recovery phrase?",
    a: "No, and you can't. Next of Kin only ever asks for public wallet addresses. Your answers describe where things are (“the sheet is in the fireproof box”), never the secret itself. If something that looks like a recovery phrase or private key is pasted in, it's refused.",
  },
  {
    q: "What does my heir need to open it?",
    a: "Two things: the link to this app and the passphrase you chose at setup. Tell them where to find the passphrase, the same way you'd tell them where your will is.",
  },
  {
    q: "What if I just forget to check in?",
    a: "A missed check-in starts a grace period, not a release. Any transaction from your wallets also counts as a sign of life, so normal use keeps the vault sealed. In this demo the interval is minutes, so you can watch it work.",
  },
  {
    q: "Where is my information kept?",
    a: "As encrypted memories on Walrus Mainnet. If this server were wiped, the whole vault could be rebuilt from Walrus. The Proof page lets you check every memory yourself.",
  },
  {
    q: "Is this legal or financial advice?",
    a: "No. It's a way to make sure the practical knowledge reaches the right person. It works alongside a will, not instead of one.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <StatusBanner />
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative">
          <div className="mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-20">
            <h1 className="t-display animate-rise text-[clamp(2.75rem,7vw,5.25rem)] leading-[1.02]">Your crypto shouldn&rsquo;t die with you</h1>
            <p className="mx-auto mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-fg-2 [animation-delay:80ms] animate-rise sm:text-[1.125rem]">
              Next of Kin learns what your family would need to know about each wallet, keeps it sealed, and hands it over only if you stop checking in. It never touches your keys.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 [animation-delay:160ms] animate-rise">
              <Link href="/owner" className="btn btn-primary btn-lg">
                Set up my vault <ChevronRight />
              </Link>
              <Link href="/heir" className="btn btn-secondary btn-lg">
                I was left a letter
              </Link>
            </div>
          </div>

          <div className="relative mt-8 pb-20 sm:mt-4">
            <div className="h-[280px] [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] sm:h-[320px]">
              <Pulse />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-12 px-4 sm:bottom-14">
              <div className="pointer-events-auto mx-auto w-fit rounded-2xl bg-bg/85 px-6 py-4 backdrop-blur-[2px]">
                <LiveStats />
              </div>
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <p className="max-w-5xl text-[clamp(1.75rem,3.6vw,2.9rem)] leading-[1.18] font-medium tracking-[-0.03em] text-fg-3">
              Roughly{" "}
              <span className="text-fg">
                <Odometer value="20" />%
              </span>{" "}
              of all bitcoin is thought to be lost for good. <span className="text-fg">Most of it wasn&rsquo;t stolen.</span> Nobody{" "}
              <span className="relative whitespace-nowrap">
                wrote down
                <svg className="absolute -bottom-2 left-0 h-2.5 w-full" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 5 Q 5 0 10 5 T 20 5 T 30 5 T 40 5 T 50 5 T 60 5 T 70 5 T 80 5 T 90 5 T 100 5 T 110 5 T 120 5" fill="none" stroke="#ff5b14" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>{" "}
              where the keys were.
            </p>
            <p className="mt-6 text-[0.8125rem] text-fg-3">Chainalysis estimate of lost bitcoin, 2020.</p>

            <div className="mt-20">
              <p className="text-[0.9375rem] text-fg-2">Families are usually left with a laptop and a phone, and none of this:</p>
              <ul className="mt-6 grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-4">
                {UNKNOWNS.map((u) => (
                  <li key={u} className="border-b border-line py-5 pr-6 text-[1.0625rem] leading-snug tracking-[-0.01em] lg:border-b-0 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h2 className="t-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05]">How it works</h2>
              <p className="max-w-md text-[1.0625rem] leading-relaxed text-fg-2">Ten minutes of plain answers now saves your family months of guessing later.</p>
            </div>
            <HowItWorks />
          </div>
        </section>

        {/* What it never does */}
        <section className="border-t border-line bg-panel">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="t-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05]">What it never does</h2>
              <p className="mt-5 max-w-sm text-[1.0625rem] leading-relaxed text-fg-2">Holding someone&rsquo;s keys is the problem, not the solution. So it doesn&rsquo;t.</p>
            </div>
            <dl className="divide-y divide-line border-y border-line">
              {NEVER.map((n) => (
                <div key={n.t} className="grid grid-cols-1 gap-1.5 py-6 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] sm:gap-8">
                  <dt className="text-[1.0625rem] font-medium tracking-[-0.01em]">{n.t}</dt>
                  <dd className="text-[0.9375rem] leading-relaxed text-fg-2">{n.b}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Built on */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-0">
              <div className="md:border-r md:border-line md:pr-12">
                <p className="text-[0.875rem] text-fg-3">Memory</p>
                <h3 className="t-display mt-3 text-[2rem] leading-tight">Walrus Mainnet</h3>
                <p className="mt-4 max-w-md text-[1rem] leading-relaxed text-fg-2">Every answer, check-in and readiness change is an encrypted memory on Walrus. The server is a cache. Wipe it and the vault rebuilds from memory.</p>
              </div>
              <div className="md:pl-12">
                <p className="text-[0.875rem] text-fg-3">Chain data</p>
                <h3 className="t-display mt-3 text-[2rem] leading-tight">Tatum</h3>
                <p className="mt-4 max-w-md text-[1rem] leading-relaxed text-fg-2">Balances, tokens, stakes and recent transactions on Sui and Ethereum. Read server-side, so the API key never reaches a browser.</p>
              </div>
            </div>
            <Link href="/proof" className="btn btn-secondary mt-14">
              Check every memory yourself <ArrowUpRight />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-32">
            <h2 className="t-display text-center text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.05]">Questions people ask</h2>
            <div className="mt-12 divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="faq group">
                  <summary className="flex items-center justify-between gap-6 py-5 text-[1.0625rem] font-medium tracking-[-0.01em]">
                    {f.q}
                    <ChevronDown className="faq-chev size-4 shrink-0 text-fg-3 transition-transform duration-300" aria-hidden="true" />
                  </summary>
                  <p className="max-w-2xl pb-6 text-[0.9375rem] leading-relaxed text-fg-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="bg-[#141311] text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-24 pb-16 sm:px-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="t-display text-[clamp(2.5rem,5vw,4rem)] leading-[1.02]">Leave a way in.</h2>
              <p className="mt-4 text-[1.0625rem] text-white/60">Setup takes about two minutes. Answer the questions whenever you like.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/owner" className="btn btn-lg bg-white text-[#141311] hover:bg-white/90">
                Set up my vault <ChevronRight />
              </Link>
              <Link href="/heir" className="btn btn-lg border border-white/15 text-white hover:bg-white/5">
                I was left a letter
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
