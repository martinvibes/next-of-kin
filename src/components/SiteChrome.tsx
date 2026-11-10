"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, CircleHelp, Github, HeartPulse, KeyRound, Lock, Mail, Menu, MessageSquareText, ShieldCheck, Wallet, X } from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";

export const GITHUB = "https://github.com/martinvibes/next-of-kin";

type Item = { href: string; label: string; body: string; icon: React.ComponentType<{ className?: string }>; external?: boolean };

const PRODUCT: Item[] = [
  { href: "/#how", label: "Map your wallets", body: "Public addresses on Sui and Ethereum", icon: Wallet },
  { href: "/#how", label: "Answer plain questions", body: "Where, how and who, encrypted in your browser", icon: MessageSquareText },
  { href: "/#how", label: "Check in", body: "One tap, or any transaction from your wallets", icon: HeartPulse },
  { href: "/heir", label: "Hand it over", body: "A letter your heir opens when it's time", icon: Mail },
];
const RESOURCES: Item[] = [
  { href: "/proof", label: "Proof", body: "Every memory on Walrus, checkable by anyone", icon: ShieldCheck },
  { href: "/heir", label: "For heirs", body: "Open a letter you were left", icon: KeyRound },
  { href: "/#faq", label: "Questions", body: "What people ask before they start", icon: CircleHelp },
  { href: GITHUB, label: "Source code", body: "Read every line on GitHub", icon: Github, external: true },
];

function ItemLink({ i, onPick }: { i: Item; onPick?: () => void }) {
  const Icon = i.icon;
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-fg-2 transition-colors group-hover/item:text-fg">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[0.875rem] font-medium text-fg">
          {i.label}
          {i.external && <ArrowUpRight className="size-3 text-fg-3" />}
        </span>
        <span className="block text-[0.8125rem] leading-snug text-fg-2">{i.body}</span>
      </span>
    </>
  );
  const cls = "group/item flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-bg-2";
  return i.external ? (
    <a href={i.href} target="_blank" rel="noreferrer" className={cls} onClick={onPick}>
      {inner}
    </a>
  ) : (
    <Link href={i.href} className={cls} onClick={onPick}>
      {inner}
    </Link>
  );
}

function NavMenu({ label, items }: { label: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const enter = () => {
    if (closeT.current) clearTimeout(closeT.current);
    setOpen(true);
  };
  const leave = () => {
    closeT.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <div ref={wrap} className="relative" onPointerEnter={(e) => e.pointerType === "mouse" && enter()} onPointerLeave={(e) => e.pointerType === "mouse" && leave()}>
      <button type="button" className="tab" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <ChevronDown className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-50 w-[22rem] -translate-x-1/2 pt-2">
          <div className="rounded-2xl border border-line bg-white/95 p-1.5 shadow-pop backdrop-blur-xl [animation:popIn_0.28s_var(--ease-out)_both]">
            {items.map((i) => (
              <ItemLink key={i.label} i={i} onPick={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Header for public pages. `overlay` makes it sit transparently over a hero
 * image until the page scrolls, then it turns solid.
 */
export function SiteHeader({ current, right, overlay }: { current?: "owner" | "heir" | "proof" | "setup"; right?: React.ReactNode; overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const solid = !overlay || scrolled || menu;

  return (
    <header
      className={`no-print sticky top-0 z-50 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-500 ${
        solid ? "border-line bg-white/85 backdrop-blur-xl" : "border-[#e5e5e533] bg-transparent"
      } ${overlay ? "-mb-[73px]" : ""}`}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1408px] items-center px-5 sm:px-8">
        <div className="flex flex-1 items-center">
          <Wordmark />
        </div>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavMenu label="Product" items={PRODUCT} />
          <NavMenu label="Resources" items={RESOURCES} />
          <Link href="/proof" className="tab" aria-current={current === "proof" ? "page" : undefined}>
            Proof
            <ArrowUpRight />
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end gap-1.5">
          {right ?? (
            <>
              <Link href="/heir" className="tab hidden lg:inline-flex" aria-current={current === "heir" ? "page" : undefined}>
                I was left a letter
              </Link>
              <Link href="/owner" className="btn btn-primary btn-sm">
                <Lock />
                <span className="hidden sm:inline">Set up a vault</span>
                <span className="sm:hidden">Vault</span>
              </Link>
            </>
          )}
          <button type="button" className="tab px-2 md:hidden" aria-expanded={menu} aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu((m) => !m)}>
            {menu ? <X className="!size-5 !opacity-100" /> : <Menu className="!size-5 !opacity-100" />}
          </button>
        </div>
      </div>
      {menu && (
        <div className="border-t border-line bg-white px-3 pt-2 pb-4 md:hidden [animation:popIn_0.3s_var(--ease-out)_both]" data-lenis-prevent>
          <p className="px-2 pt-2 pb-1 text-[0.75rem] font-medium text-fg-3">Product</p>
          {PRODUCT.map((i) => (
            <ItemLink key={i.label} i={i} onPick={() => setMenu(false)} />
          ))}
          <p className="px-2 pt-3 pb-1 text-[0.75rem] font-medium text-fg-3">Resources</p>
          {RESOURCES.map((i) => (
            <ItemLink key={i.label} i={i} onPick={() => setMenu(false)} />
          ))}
        </div>
      )}
    </header>
  );
}

const FOOT: { title: string; links: { href: string; label: string; external?: boolean; badge?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/owner", label: "Set up a vault" },
      { href: "/heir", label: "For heirs" },
      { href: "/proof", label: "Proof" },
    ],
  },
  {
    title: "Built with",
    links: [
      { href: "https://docs.wal.app", label: "Walrus", external: true },
      { href: "https://tatum.io", label: "Tatum", external: true },
      { href: GITHUB, label: "Source code", external: true },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/#faq", label: "Questions" },
      { href: `${GITHUB}#readme`, label: "README", external: true },
    ],
  },
];

/** Dark closing band: the last call to action, the link columns, and a strip of the scene. */
export function SiteFooter({ cta = true }: { cta?: boolean }) {
  return (
    <footer className="no-print relative isolate overflow-hidden bg-[#0a0a0a] text-[#fafafa]">
      {cta && (
        <div className="border-b border-white/10">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-16 sm:px-8 sm:py-24 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-[560px] flex-col gap-3">
              <h2 className="t-display text-[32px] leading-[1.08] sm:text-[44px]">
                Leave a way in for <span className="t-accent text-[#f3eef0]">the people you love</span>
              </h2>
              <p className="text-[15px] leading-[1.5] text-[#a79ea9]">Setup takes about two minutes. No account, and never a recovery phrase.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/owner" className="btn bg-[#fafafa] pr-3.5 pl-4 text-[#0a0a0a] hover:bg-white">
                Set up my vault <ChevronRight className="text-[#0a0a0a]/60" />
              </Link>
              <Link href="/heir" className="btn bg-[#241c26] text-[#fafafa] hover:bg-[#2f2531]">
                I was left a letter
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-white/10">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 border-b border-white/10 px-6 py-12 sm:px-8 lg:col-span-1 lg:border-b-0">
            <div className="flex flex-col gap-5">
              <Wordmark light size={27} />
              <p className="max-w-[260px] text-[14px] leading-relaxed text-[#a79ea9]">What you know about your money, kept for the people who will need it.</p>
              <a href={GITHUB} target="_blank" rel="noreferrer" aria-label="Next of Kin on GitHub" className="w-fit text-[#a79ea9] transition-colors hover:text-white">
                <Github className="size-[18px]" />
              </a>
            </div>
          </div>
          {FOOT.map((c, i) => (
            <div key={c.title} className={`border-white/10 px-6 py-12 sm:px-8 lg:border-l ${i === 1 ? "border-l" : ""} ${i === 2 ? "col-span-2 border-t lg:col-span-1 lg:border-t-0" : ""}`}>
              <p className="text-[14px] font-medium">{c.title}</p>
              <ul className="mt-5 space-y-3.5 text-[14px] text-[#fafafa]/80">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                        {l.label} <ArrowUpRight className="size-3.5 text-[#a79ea9]" />
                      </a>
                    ) : (
                      <Link href={l.href} className="transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* A strip of the scene, smeared into light: the same tree, seen from the ground up. */}
      <div className="relative h-[220px] border-b border-white/10 sm:h-[320px]" aria-hidden="true">
        <div className="absolute inset-0 bg-[url(/scene/tree-sm.webp)] bg-[length:100%_2400%] bg-[position:50%_66%] opacity-70 blur-[1.5px] saturate-[0.85]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#0a0a0a,transparent_35%,transparent_70%,#0a0a0a)]" />
        <div className="grain absolute inset-0 opacity-40 mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-0 mx-auto hidden w-full max-w-[1200px] grid-cols-[2fr_1fr_1fr_1fr] lg:grid">
          <span />
          <span className="border-l border-white/10" />
          <span className="border-l border-white/10" />
          <span className="border-l border-white/10" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-6 py-8 text-[13px] text-[#a79ea9] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© 2026 Next of Kin. Built for Total Recall. Not legal or financial advice.</p>
        <div className="flex items-center gap-6">
          <a href="https://commons.wikimedia.org/wiki/File:Baum_im_Nebel_bei_Dorfmark_(2).jpg" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
            Photo: RogerWiki, CC0
          </a>
          <Link href="/proof" className="transition-colors hover:text-white">
            Proof
          </Link>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-white">
            GitHub <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
