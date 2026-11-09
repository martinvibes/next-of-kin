import Link from "next/link";
import { Seal } from "@/components/Seal";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { LiveStrip } from "@/components/LiveStrip";

const PROMISES = [
  {
    title: "We never hold keys.",
    body: "Recovery phrases and private keys are detected and refused, in your browser and again on the server.",
  },
  {
    title: "Sealed before it leaves you.",
    body: "Every answer is encrypted in your browser with your passphrase. Our server can't read it.",
  },
  {
    title: "Kept on Walrus, not with us.",
    body: "Each answer is a memory on Walrus Mainnet. Wipe our server and everything comes back.",
  },
  {
    title: "Opened only if you go quiet.",
    body: "Your heir sees nothing until you stop checking in and your wallets stop moving on-chain.",
  },
];

const UNKNOWNS = [
  "Which wallets exist, and on which chains.",
  "That the SUI is staked, and has to be withdrawn first.",
  "Where the phone or hardware wallet is kept.",
  "Who you wanted it to go to.",
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 pt-8 pb-24 sm:px-6 lg:grid-cols-[1.18fr_0.82fr] lg:gap-8 lg:pt-20">
          <div className="animate-rise">
            <h1 className="t-display text-[clamp(2.9rem,7.4vw,5.15rem)] text-ink">
              <span className="block whitespace-nowrap max-[420px]:whitespace-normal">Keys open wallets.</span>
              <span className="block whitespace-nowrap max-[420px]:whitespace-normal">Memory finds them.</span>
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-2">
              When someone dies holding crypto, their family may get the keys but rarely the knowledge. Next of Kin watches your wallets, asks you one
              question at a time, and keeps the answers sealed for the person you choose.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/owner" className="btn btn-primary">
                Prepare my letter
              </Link>
              <Link href="/heir" className="btn btn-secondary">
                I was left a letter
              </Link>
            </div>
            <LiveStrip />
          </div>

          <HeroLetter />
        </section>

        {/* ─── Promises (plain statements, North-style) ─────────── */}
        <section aria-label="Our promises" className="border-y border-rule/80 bg-sheet/40">
          <ul className="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {PROMISES.map((p) => (
              <li key={p.title}>
                <p className="t-serif text-[1.15rem] leading-snug text-ink">{p.title}</p>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── The problem ──────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <blockquote className="t-display text-balance text-[clamp(2rem,4.4vw,3.35rem)] leading-[1.08] text-ink">
            Every bank asks for your next of kin. None of them ask what your next of kin will need to know.
          </blockquote>
          <div className="self-end">
            <p className="text-ink-2">Seed-phrase tools solve the key. Nobody solves the knowledge. Heirs are left guessing:</p>
            <ul className="mt-5 space-y-3">
              {UNKNOWNS.map((u) => (
                <li key={u} className="t-serif flex gap-3 text-[1.0625rem] leading-snug">
                  <span aria-hidden="true" className="mt-[0.55em] h-px w-4 shrink-0 bg-brass" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── How it works ─────────────────────────────────────── */}
        <section id="how" className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-labelledby="how-title">
          <h2 id="how-title" className="t-display text-[clamp(2rem,4vw,3rem)]">
            How it works
          </h2>
          <ol className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
            <Step n={1} title="It watches">
              Add the wallets you want covered. Next of Kin reads balances and stakes on Sui (and Ethereum) through Tatum, so it knows what there is to
              lose.
            </Step>
            <Step n={2} title="It asks">
              One question at a time, starting with the one that protects the most money. Where is the key? How is it opened? Who should get it?
            </Step>
            <Step n={3} title="It releases">
              If you stop checking in and your wallets go quiet on-chain, your heir unlocks a step-by-step recovery guide with the passphrase you left
              them.
            </Step>
          </ol>
        </section>

        {/* ─── Where / How / Who ────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 py-28 sm:px-6 lg:grid-cols-2" aria-labelledby="formula-title">
          <IndexCards />
          <div>
            <h2 id="formula-title" className="t-display text-balance text-[clamp(2rem,4vw,3rem)]">
              Readiness is arithmetic, not a feeling.
            </h2>
            <p className="mt-6 max-w-[32rem] text-ink-2">
              An asset counts as covered when your heir would know three things: <em className="t-serif not-italic text-ink">where</em> the key is,{" "}
              <em className="t-serif not-italic text-ink">how</em> to open it, and <em className="t-serif not-italic text-ink">who</em> it&rsquo;s for.
              Your score is the share of your money that&rsquo;s covered.
            </p>
            <p className="mt-6 inline-block rounded-lg bg-sheet px-4 py-3 text-[0.9375rem] shadow-[0_0_0_1px_var(--rule)]">
              Readiness = covered USD ÷ total USD × 100
            </p>
            <p className="mt-6 max-w-[32rem] text-ink-2">
              Then it checks its memory against the chain. If a balance moves by more than a quarter, that answer stops counting until you confirm it.
            </p>
          </div>
        </section>

        {/* ─── Doors ────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-label="Where to go next">
          <div className="grid gap-4 md:grid-cols-3">
            <Door href="/owner" title="I hold the crypto" body="Set up your vault, add wallets and answer the questions that matter most." cta="Prepare my letter" primary />
            <Door href="/heir" title="I was named as next of kin" body="See whether a letter has been released, and open it with the passphrase you were given." cta="Open the heir view" />
            <Door href="/proof" title="I'm judging this" body="Every memory on Walrus Mainnet, every Tatum call, and a full rebuild from Walrus." cta="See the proof" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative border-t border-ink/80 pt-5">
      <p className="t-display text-[1.75rem] leading-none">
        <span className="t-num mr-3 text-brass">{n}</span>
        {title}
      </p>
      <p className="mt-4 max-w-[26rem] text-ink-2">{children}</p>
    </li>
  );
}

function Door({ href, title, body, cta, primary }: { href: string; title: string; body: string; cta: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-[10px] p-6 transition-shadow ${primary ? "bg-ink text-sheet" : "sheet hover:shadow-[var(--shadow-lift)]"}`}
    >
      <div>
        <p className="t-display text-[1.6rem] leading-tight">{title}</p>
        <p className={`mt-3 text-[0.9375rem] ${primary ? "text-sheet/75" : "text-ink-2"}`}>{body}</p>
      </div>
      <p className={`mt-8 text-[0.9375rem] font-semibold underline decoration-1 underline-offset-4 ${primary ? "decoration-sheet/40" : "decoration-rule"} group-hover:decoration-current`}>
        {cta}
      </p>
    </Link>
  );
}

function HeroLetter() {
  return (
    <figure className="relative mx-auto w-full max-w-[30rem] lg:mr-0">
      <div className="sheet sheet-ruled px-7 pt-8 pb-14 sm:px-10 sm:pt-10" style={{ transform: "rotate(-1.2deg)" }}>
        <p className="text-[0.8125rem] text-ink-3">An example of what your heir receives</p>
        <div className="t-letter mt-6 text-pretty text-ink">
          <p>Dear Ada,</p>
          <p className="mt-4">If this has opened, I&rsquo;ve stopped checking in. Everything you need is below. Take your time.</p>
          <div className="mt-6 border-l-2 border-brass/60 pl-4">
            <p className="font-sans text-[0.9375rem] font-semibold">Savings, on Sui</p>
            <p className="mt-1 text-[0.98rem] leading-relaxed">
              Most of it is staked. Open Slush, go to Staking and withdraw; it arrives at the next epoch, about a day.
            </p>
            <p className="mt-2 text-[0.98rem] leading-relaxed">The phone is in the fireproof box. Uncle Femi has the PIN.</p>
          </div>
          <p className="mt-6">Split it equally between you and Tobi.</p>
          <p className="mt-5 font-hand text-[2.6rem] leading-none text-ink/85" aria-label="Signed, Dad">
            Dad
          </p>
        </div>
      </div>
      <div className="absolute -right-3 -bottom-12 sm:-right-10">
        <Seal size={176} tone="brass" label="Sealed until needed">
          <span className="grid h-[86px] w-[86px] place-items-center rounded-full bg-sheet shadow-[0_0_0_1px_var(--brass-2)]">
            <span className="t-display text-[1.3rem] leading-none text-brass">Sealed</span>
          </span>
        </Seal>
      </div>
    </figure>
  );
}

function IndexCards() {
  const cards = [
    { field: "Where", q: "Where is the key?", a: "Slush on my phone. Recovery sheet in the fireproof box.", rot: -3.5, x: "0%" },
    { field: "How", q: "How is it opened?", a: "Phone PIN is with my lawyer. Withdraw the stake first.", rot: 1.5, x: "13%" },
    { field: "Who", q: "Who is it for?", a: "Split equally between my two sisters.", rot: -1, x: "26%" },
  ];
  return (
    <ol className="relative mx-auto flex w-full max-w-[34rem] flex-col" aria-label="The three things your heir needs: where, how and who">
      {cards.map((c) => (
        <li
          key={c.field}
          className="sheet flex w-[78%] items-start gap-4 p-5 sm:gap-5 [&+li]:-mt-1.5"
          style={{ marginLeft: c.x, transform: `rotate(${c.rot}deg)` }}
        >
          <p className="t-display w-[3.9rem] shrink-0 text-[1.6rem] leading-none text-brass sm:w-[4.6rem] sm:text-[1.85rem]">{c.field}</p>
          <div>
            <p className="text-sm font-semibold text-ink">{c.q}</p>
            <p className="t-serif mt-1.5 text-[0.95rem] leading-relaxed text-pretty text-ink-2">{c.a}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
