import Link from "next/link";
import { Github } from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";

const NAV = [
  { href: "/owner", label: "Dashboard" },
  { href: "/heir", label: "Heir view" },
  { href: "/proof", label: "Proof" },
];

/** Header for public pages (landing, heir, proof, setup). The owner dashboard has its own shell. */
export function SiteHeader({ current, right }: { current?: "owner" | "heir" | "proof" | "setup"; right?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-1 text-[0.8125rem] sm:text-sm" aria-label="Main">
          {NAV.map((n) => {
            const active = current && n.href === `/${current}`;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors sm:px-3 ${active ? "bg-white/[0.06] text-fg" : "text-fg-2 hover:text-fg"} ${n.href === "/owner" ? "max-sm:hidden" : ""}`}
              >
                {n.label}
              </Link>
            );
          })}
          {right ?? (
            <Link href="/owner" className="btn btn-primary btn-sm ml-1.5 whitespace-nowrap">
              Open app
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mx-auto mt-24 w-full max-w-6xl px-4 pb-10 sm:px-6">
      <div className="flex flex-col gap-4 border-t border-line pt-6 text-[0.8125rem] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Built for Total Recall with{" "}
          <a className="text-fg-2 hover:text-fg" href="https://memory.walrus.xyz" target="_blank" rel="noreferrer">
            Walrus Memory
          </a>{" "}
          and{" "}
          <a className="text-fg-2 hover:text-fg" href="https://tatum.io" target="_blank" rel="noreferrer">
            Tatum
          </a>
          . Not legal advice.
        </p>
        <p className="flex items-center gap-5">
          <Link className="hover:text-fg" href="/proof">
            Mainnet proof
          </Link>
          <a className="inline-flex items-center gap-1.5 hover:text-fg" href="https://github.com/martinvibes/next-of-kin" target="_blank" rel="noreferrer">
            <Github className="size-3.5" aria-hidden="true" />
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}
