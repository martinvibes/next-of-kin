import Link from "next/link";
import { ArrowRight, Blocks, Database, Eye, HeartPulse, KeyRound, Lock, MailOpen, MessageSquareText, ShieldCheck, ShieldOff, UserRound, Wrench } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { StatusBanner } from "@/components/StatusBanner";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { LiveStats } from "@/components/landing/LiveStats";

const UNKNOWNS = [
  "Which wallets exist, and on which chains.",
  "That the SUI is staked, and has to be withdrawn first.",
  "Where the phone or hardware wallet is kept.",
  "Who you wanted it to go to.",
];

const STEPS = [
  {
    icon: Eye,
    tone: "bg-sky-wash text-sky",
    title: "It watches",
    body: "Add the wallets you want covered. Next of Kin reads balances and stakes on Sui (and Ethereum) through Tatum, so it knows what there is to lose.",
  },
  {
    icon: MessageSquareText,
    tone: "bg-mint-wash text-mint",
    title: "It asks",
    body: "One question at a time, starting with the one that protects the most money. Where is the key? How is it opened? Who should get it?",
  },
  {
    icon: MailOpen,
    tone: "bg-violet-wash text-violet",
    title: "It hands over",
    body: "If you stop checking in and your wallets go quiet on-chain, your heir opens a step-by-step recovery guide with the passphrase you left them.",
  },
];

const FIELDS = [
  { icon: KeyRound, tone: "text-mint", name: "Where", q: "Where is the key?", a: "Slush on my phone. The recovery sheet is in the fireproof box." },
  { icon: Wrench, tone: "text-violet", name: "How", q: "How is it opened?", a: "The phone PIN is with my lawyer. Withdraw the stake first." },
  { icon: UserRound, tone: "text-sky", name: "Who", q: "Who is it for?", a: "Split equally between my two sisters." },
];

const PROMISES = [
  { icon: ShieldOff, title: "We never hold keys", body: "Recovery phrases and private keys are detected and refused, in your browser and again on the server." },
  { icon: Lock, title: "Encrypted before it leaves you", body: "Every answer is encrypted in your browser with your passphrase. Our server can't read it." },
  { icon: Database, title: "Kept on Walrus, not with us", body: "Each answer is a memory on Walrus Mainnet. Wipe our server and everything comes back." },
  { icon: HeartPulse, title: "Opened only if you go quiet", body: "Your heir sees nothing until you stop checking in and your wallets stop moving on-chain." },
];

export default function Home() {
  return (
    <div className="aurora relative min-h-dvh overflow-x-clip">
      <StatusBanner />
      <SiteHeader />
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[640px]" aria-hidden="true" />
      <main id="main" className="relative">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-24">
          <div className="animate-rise">
            <span className="pill pill-mint">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Crypto inheritance, without handing over keys
            </span>
            <h1 className="mt-6 text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.04] font-semibold tracking-[-0.045em]">
              <span className="block">Keys open wallets.</span>
              <span className="block">Memory finds them.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed text-fg-2">
              When someone dies holding crypto, their family may get the keys but rarely the knowledge. Next of Kin watches your wallets, asks you one question at a time, and keeps the
              answers sealed for the person you choose.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/owner" className="btn btn-primary btn-lg">
                Set up my vault <ArrowRight />
              </Link>
              <Link href="/heir" className="btn btn-secondary btn-lg">
                I was left a letter
              </Link>
            </div>
            <LiveStats />
          </div>
          <HeroPreview />
        </section>

        {/* The problem */}
        <section className="border-y border-line bg-bg-2/70" aria-labelledby="problem-title">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <h2 id="problem-title" className="text-[clamp(1.8rem,3.8vw,2.7rem)] leading-[1.12] font-semibold tracking-[-0.035em] text-balance">
              Every bank asks for your next of kin. None of them ask what your next of kin will need to know.
            </h2>
            <div className="self-end">
              <p className="text-fg-2">Seed-phrase tools solve the key. Nobody solves the knowledge. Heirs are left guessing:</p>
              <ul className="mt-5 space-y-2.5">
                {UNKNOWNS.map((u) => (
                  <li key={u} className="flex gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-[0.9375rem]">
                    <span className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-amber" aria-hidden="true" />
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6" aria-labelledby="how-title">
          <h2 id="how-title" className="text-[clamp(1.8rem,3.6vw,2.5rem)] font-semibold tracking-[-0.035em]">
            How it works
          </h2>
          <p className="mt-3 max-w-xl text-fg-2">Three things happen, in order. You only do the middle one.</p>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card relative p-6">
                <div className="flex items-center justify-between">
                  <span className={`grid size-11 place-items-center rounded-xl ${s.tone}`}>
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="t-num text-[0.8125rem] text-fg-3">Step {i + 1}</span>
                </div>
                <h3 className="mt-6 text-[1.2rem] font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Readiness */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16" aria-labelledby="formula-title">
          <div>
            <h2 id="formula-title" className="text-[clamp(1.8rem,3.6vw,2.5rem)] leading-[1.12] font-semibold tracking-[-0.035em] text-balance">
              Readiness is arithmetic, not a feeling
            </h2>
            <p className="mt-5 max-w-[32rem] text-fg-2">
              An asset counts as covered when your heir would know three things: where the key is, how to open it, and who it&rsquo;s for. Your score is the share of your money that&rsquo;s
              covered.
            </p>
            <div className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line-2 bg-panel px-4 py-3 text-[0.9375rem]">
              <span className="text-fg-3">Readiness</span>
              <span className="t-mono text-fg">= covered USD ÷ total USD × 100</span>
            </div>
            <p className="mt-6 max-w-[32rem] text-fg-2">
              Then it checks its memory against the chain. If a balance moves by more than a quarter, that answer stops counting until you confirm it. No language model decides any of
              this.
            </p>
          </div>
          <ul className="space-y-3" aria-label="The three things your heir needs">
            {FIELDS.map((f) => (
              <li key={f.name} className="card flex items-start gap-4 p-5">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] ${f.tone}`}>
                  <f.icon className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{f.name}</span>
                    <span className="text-[0.8125rem] text-fg-3">{f.q}</span>
                  </p>
                  <p className="mt-1.5 font-serif text-[0.98rem] leading-relaxed text-fg-2">&ldquo;{f.a}&rdquo;</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Built on */}
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-labelledby="built-title">
          <h2 id="built-title" className="text-[clamp(1.8rem,3.6vw,2.5rem)] font-semibold tracking-[-0.035em]">
            What it&rsquo;s built on
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="card glow-violet p-6 sm:p-7">
              <span className="grid size-11 place-items-center rounded-xl bg-violet-wash text-violet">
                <Database className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-[1.2rem] font-semibold tracking-[-0.02em]">Walrus Memory is the database</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-2">
                Wallets, answers, confirmations, check-ins and readiness snapshots are each written as a memory on Walrus Mainnet. The server keeps a disposable cache, and can rebuild
                everything from Walrus in one click.
              </p>
              <Link href="/proof" className="link mt-5 inline-flex items-center gap-1.5 text-[0.875rem]">
                See every memory and its blob <ArrowRight className="size-3.5" />
              </Link>
            </article>
            <article className="card p-6 sm:p-7">
              <span className="grid size-11 place-items-center rounded-xl bg-sky-wash text-sky">
                <Blocks className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-[1.2rem] font-semibold tracking-[-0.02em]">Tatum reads the chain</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-2">
                Balances, staked SUI and validators, USD prices, and your latest outgoing transaction. That last one doubles as proof of life, so the switch doesn&rsquo;t fire while your
                wallets are still moving.
              </p>
              <Link href="/proof" className="link mt-5 inline-flex items-center gap-1.5 text-[0.875rem]">
                See the Tatum calls <ArrowRight className="size-3.5" />
              </Link>
            </article>
          </div>
        </section>

        {/* Promises */}
        <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6" aria-label="What we promise">
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((p) => (
              <li key={p.title}>
                <p.icon className="size-5 text-mint" aria-hidden="true" />
                <p className="mt-4 font-semibold">{p.title}</p>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-fg-2">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Doors */}
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-labelledby="doors-title">
          <h2 id="doors-title" className="sr-only">
            Where to go next
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Door href="/owner" title="I hold the crypto" body="Set up your vault, add wallets and answer the questions that matter most." cta="Set up my vault" primary />
            <Door href="/heir" title="I was named as next of kin" body="See whether a letter has been released, and open it with the passphrase you were given." cta="Open the heir view" />
            <Door href="/proof" title="I want to verify it" body="Every memory on Walrus Mainnet, every Tatum call, and a full rebuild from Walrus." cta="See the proof" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Door({ href, title, body, cta, primary }: { href: string; title: string; body: string; cta: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`group card flex flex-col justify-between p-6 transition-colors hover:border-line-2 ${primary ? "glow-mint border-mint/25 hover:border-mint/40" : ""}`}
    >
      <div>
        <p className="text-[1.2rem] font-semibold tracking-[-0.02em]">{title}</p>
        <p className="mt-2 text-[0.9375rem] text-fg-2">{body}</p>
      </div>
      <p className={`mt-8 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium ${primary ? "text-mint" : "text-fg"}`}>
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </p>
    </Link>
  );
}
