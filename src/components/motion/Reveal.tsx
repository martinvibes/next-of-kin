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

/** A headline whose words rise one after another out of a mask. */
export function SplitText({ text, as = "h2", className = "", delay = 0, id }: { text: string; as?: Tag; className?: string; delay?: number; id?: string }) {
  const { ref, inView } = useInView<HTMLElement>();
  const words = text.split(" ");
  return createElement(
    as,
    { ref, id, className: `${inView ? "is-in" : ""} ${className}`, "aria-label": text },
    words.map((w, i) => (
      <span key={i} aria-hidden="true">
        <span className="split-w">
          <span style={{ "--i": i, "--d": `${delay}ms` } as React.CSSProperties}>{w}</span>
        </span>
        {i < words.length - 1 ? " " : null}
      </span>
    )),
  );
}
