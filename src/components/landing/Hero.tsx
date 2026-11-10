"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { LiveStats } from "./LiveStats";

/** The link an heir will need, one click to copy. */
function HeirLink() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const shown = origin ? `${origin.replace(/^https?:\/\//, "")}/heir` : "/heir";
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/heir`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className="group inline-flex h-10 max-w-full items-center gap-2.5 rounded-xl bg-white/35 pr-3.5 pl-4 text-[13px] text-[#0a0a0a] backdrop-blur-md transition-colors hover:bg-white/55"
      aria-label="Copy the link your heir will need"
      title="Your heir opens the letter at this address"
    >
      <span className="text-fg-2">heir link</span>
      <span className="t-mono truncate">{shown}</span>
      {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5 text-fg-2 transition-colors group-hover:text-fg" />}
    </button>
  );
}

export function Hero() {
  const scene = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // The scene drifts down a little slower than the page: a gentle parallax.
  useEffect(() => {
    const el = scene.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 1400);
        el.style.transform = `translate3d(0, ${y * 0.3}px, 0) scale(${1 + y * 0.00008})`;
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
    <section
      className="relative isolate flex min-h-[max(720px,100svh)] flex-col overflow-hidden lg:max-h-[960px]"
      aria-labelledby="hero-title"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        e.currentTarget.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      }}
    >
      <div ref={scene} className="absolute inset-0 -z-10 origin-top will-change-transform" aria-hidden="true">
        <div className="absolute inset-0 transition-transform duration-[2000ms] ease-[var(--ease-out)] [transform:translate3d(calc(var(--px,0)*14px),calc(var(--py,0)*8px),0)] motion-reduce:transform-none lg:-right-[26%]">
          <div className="absolute inset-0 animate-[kenBurns_2.6s_var(--ease-out)_both]">
            <Image src="/scene/tree.webp" alt="" fill priority sizes="100vw" className="object-cover object-[68%_100%] contrast-[1.12] saturate-[1.08]" />
          </div>
        </div>
        {/* fog that never quite settles, and leans away from the pointer */}
        <div className="absolute inset-0 overflow-hidden transition-transform duration-[1600ms] ease-[var(--ease-out)] [transform:translate3d(calc(var(--px,0)*-48px),calc(var(--py,0)*-20px),0)] motion-reduce:transform-none">
          <div className="absolute top-[36%] left-[-15%] h-[34%] w-[75%] rounded-[50%] bg-white/45 blur-[64px] [animation:fogDrift_28s_ease-in-out_infinite_alternate]" />
          <div className="absolute top-[52%] right-[-20%] h-[26%] w-[70%] rounded-[50%] bg-white/30 blur-[72px] [animation:fogDrift_36s_ease-in-out_infinite_alternate-reverse]" />
        </div>
        {/* a soft light veil keeps the copy readable over the trunk */}
        <div className="absolute inset-x-0 top-0 h-[62%] bg-[radial-gradient(ellipse_75%_65%_at_50%_32%,rgba(250,250,250,0.62),transparent_72%)] sm:bg-[radial-gradient(ellipse_45%_55%_at_50%_30%,rgba(250,250,250,0.45),transparent_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(250,250,250,0.5)_0%,rgba(250,250,250,0.15)_28%,transparent_50%,rgba(24,18,14,0.18)_72%,rgba(24,18,14,0.5)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center px-6 pt-[calc(72px+40px)] sm:px-8 sm:pt-[calc(72px+56px)]">
        <div className="flex w-full flex-col items-center gap-7 sm:gap-10">
          <div className="flex w-full flex-col items-center gap-4 sm:gap-6">
            <h1 id="hero-title" className={`t-display [font-variation-settings:'opsz'_120,'SOFT'_0,'WONK'_0] max-w-[920px] px-1 text-center text-[44px] leading-[46px] text-[#0a0a0a] sm:text-[68px] sm:leading-[68px] lg:text-[76px] lg:leading-[76px] ${shown ? "is-in" : ""}`}>
              <span className="sr-only">Your crypto shouldn&rsquo;t die with you</span>
              {[["Your", "crypto", "shouldn’t"], ["die", "with", "you"]].map((line, li) => (
                <span key={li} className="block" aria-hidden="true">
                  {line.map((w, wi) => (
                    <span key={w}>
                      <span className="split-w -mb-[0.12em] pb-[0.12em]">
                        <span style={{ "--i": li * 3 + wi, "--d": "120ms" } as React.CSSProperties}>{w}</span>
                      </span>
                      {wi < line.length - 1 ? " " : null}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="hero-rise hero-rise--2 max-w-[576px] px-1 text-center text-[15px] leading-6 text-[#4a3f4c] sm:text-[17px] sm:leading-7">
              <span className="sm:block">Next of Kin learns what your family would need to know about each wallet, </span>
              <span className="sm:block">keeps it sealed, and hands it over only if you stop checking in.</span>
            </p>
          </div>
          <div className="hero-rise hero-rise--3 flex flex-col items-center gap-2 sm:flex-row">
            <Link href="/owner" className="btn btn-primary pr-3.5 pl-4">
              Set up my vault <ChevronRight className="opacity-70" />
            </Link>
            <HeirLink />
          </div>
        </div>
        <div className="hero-rise hero-rise--4 mt-auto w-full py-10 sm:py-12">
          <LiveStats />
        </div>
      </div>
    </section>
  );
}
