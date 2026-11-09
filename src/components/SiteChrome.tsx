import Link from "next/link";
import { SealMark } from "./Seal";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 text-ink ${className ?? ""}`} aria-label="Next of Kin, home">
      <SealMark size={26} className="text-brass transition-transform duration-500 group-hover:rotate-[30deg]" />
      <span className="t-display text-[1.35rem] leading-none tracking-[-0.01em]">Next of Kin</span>
    </Link>
  );
}

const NAV = [
  { href: "/owner", label: "Owner" },
  { href: "/heir", label: "Heir" },
  { href: "/proof", label: "Proof" },
];

export function SiteHeader({ current, right }: { current?: "owner" | "heir" | "proof" | "setup"; right?: React.ReactNode }) {
  return (
    <header className="no-print mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Wordmark />
      <nav className="flex items-center gap-1 text-[0.9375rem]" aria-label="Main">
        {NAV.map((n) => {
          const active = current && n.href === `/${current}`;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition-colors ${active ? "bg-sheet text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-2 hover:text-ink"}`}
            >
              {n.label}
            </Link>
          );
        })}
        {right}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mx-auto mt-24 w-full max-w-6xl px-4 pb-10 sm:px-6">
      <div className="flex flex-col gap-4 border-t border-rule pt-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Built for Total Recall with{" "}
          <a className="link" href="https://memory.walrus.xyz" target="_blank" rel="noreferrer">
            Walrus Memory
          </a>{" "}
          and{" "}
          <a className="link" href="https://tatum.io" target="_blank" rel="noreferrer">
            Tatum
          </a>
          . Not legal advice.
        </p>
        <p className="flex gap-4">
          <Link className="link" href="/proof">
            Mainnet proof
          </Link>
          <a className="link" href="https://github.com/martinvibes/next-of-kin" target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}
