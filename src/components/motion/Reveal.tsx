"use client";

import { createElement, useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (and stays true unless `once` is false). */
export function useInView<T extends Element>({ once = true, margin = "0px 0px -12% 0px", threshold = 0 }: { once?: boolean; margin?: string; threshold?: number } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin: margin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin, threshold]);
  return { ref, inView };
}

type Tag = "div" | "section" | "li" | "ul" | "p" | "span" | "h1" | "h2" | "h3" | "article" | "dl" | "header";

/** Rises out of a slight blur the first time it scrolls into view. */
export function Reveal({ as = "div", delay = 0, className = "", children, style, ...rest }: { as?: Tag; delay?: number; className?: string; children?: React.ReactNode } & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const { ref, inView } = useInView<HTMLElement>();
  return createElement(as, { ...rest, ref, className: `reveal ${inView ? "is-in" : ""} ${className}`, style: { "--d": `${delay}ms`, ...style } as React.CSSProperties }, children);
}

/**
 * An italic serif phrase whose letters surface out of blur once an ancestor gets `.is-in`.
 * Letters are grouped per word so a phrase never breaks mid-word.
 */
export function FogText({ text, start = 520, className = "" }: { text: string; start?: number; className?: string }) {
  const words = text.split(" ");
  // running letter index across words, counting each space as one step
  const offsets = words.map((_, wi) => words.slice(0, wi).reduce((sum, w) => sum + w.length + 1, 0));
  return (
    <span className={`t-accent fog-in ${className}`} style={{ "--fog-start": `${start}ms` } as React.CSSProperties} aria-hidden="true">
      {words.map((w, wi) => (
        <span key={wi}>
          <span className="inline-block whitespace-nowrap">
            {Array.from(w).map((ch, ci) => (
              <span key={ci} className="fl" style={{ "--c": offsets[wi] + ci } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

/** Words rise out of masks; an optional trailing `accent` phrase surfaces in italic serif. */
export function SplitText({ text, accent, as = "h2", className = "", delay = 0, id }: { text: string; accent?: string; as?: Tag; className?: string; delay?: number; id?: string }) {
  const { ref, inView } = useInView<HTMLElement>();
  const tail = accent && text.endsWith(accent) ? accent : null;
  const words = (tail ? text.slice(0, -tail.length).trim() : text).split(" ");
  return createElement(
    as,
    { ref, id, className: `${inView ? "is-in" : ""} ${className}`, "aria-label": text },
    words.map((w, i) => (
      <span key={i} aria-hidden="true">
        <span className="split-w">
          <span style={{ "--i": i, "--d": `${delay}ms` } as React.CSSProperties}>{w}</span>
        </span>
        {i < words.length - 1 || tail ? " " : null}
      </span>
    )),
    tail ? <FogText key="accent" text={tail} start={delay + words.length * 55 + 260} /> : null,
  );
}
