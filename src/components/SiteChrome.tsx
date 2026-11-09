import Link from "next/link";
import { ArrowUpRight, ChevronRight, Github } from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";

const NAV = [
  { href: "/#how", label: "How it works", key: "how" },
  { href: "/heir", label: "For heirs", key: "heir" },
  { href: "/proof", label: "Proof", key: "proof" },
];

/** Header for public pages (landing, heir, proof, setup). The owner app has its own. */
export function SiteHeader({ current, right }: { current?: "owner" | "heir" | "proof" | "setup"; right?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current === n.key ? "page" : undefined} className="tab">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/heir" className="tab md:hidden" aria-current={current === "heir" ? "page" : undefined}>
            For heirs
          </Link>
          {right ?? (
            <Link href="/owner" className="btn btn-primary btn-sm">
              Open vault <ChevronRight />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print bg-[#141311] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 border-b border-white/10 py-14 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Wordmark light />
            <p className="mt-4 text-[0.875rem] leading-relaxed text-white/55">What your family would need to know about your crypto, kept sealed until it&rsquo;s needed.</p>
          </div>
          <div className="flex gap-16 text-[0.875rem]">
            <ul className="space-y-3">
              <li className="text-white/45">Product</li>
              <li>
                <Link className="text-white/80 hover:text-white" href="/owner">
                  Your vault
                </Link>
              </li>
              <li>
                <Link className="text-white/80 hover:text-white" href="/heir">
                  For heirs
                </Link>
              </li>
              <li>
                <Link className="text-white/80 hover:text-white" href="/proof">
                  Mainnet proof
                </Link>
              </li>
            </ul>
            <ul className="space-y-3">
              <li className="text-white/45">Built with</li>
              <li>
                <a className="inline-flex items-center gap-1 text-white/80 hover:text-white" href="https://memory.walrus.xyz" target="_blank" rel="noreferrer">
                  Walrus Memory <ArrowUpRight className="size-3.5 text-white/40" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a className="inline-flex items-center gap-1 text-white/80 hover:text-white" href="https://tatum.io" target="_blank" rel="noreferrer">
                  Tatum <ArrowUpRight className="size-3.5 text-white/40" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a className="inline-flex items-center gap-1.5 text-white/80 hover:text-white" href="https://github.com/martinvibes/next-of-kin" target="_blank" rel="noreferrer">
                  <Github className="size-3.5" aria-hidden="true" /> Source
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="flex flex-col gap-2 py-6 text-[0.8125rem] text-white/40 sm:flex-row sm:justify-between">
          <span>Built for Total Recall, 2026.</span>
          <span>Not legal or financial advice.</span>
        </p>
      </div>
    </footer>
  );
}
