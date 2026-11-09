"use client";

import { useEffect } from "react";
import Lenis from "lenis";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Eased, slower wheel scrolling on every page. Touch stays native, people who
 * ask for reduced motion get the browser's own scrolling, and anything marked
 * data-lenis-prevent (menus, inner scrollers) scrolls on its own.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.07,
      wheelMultiplier: 0.8,
      smoothWheel: true,
      autoRaf: true,
      anchors: { offset: -88 },
      allowNestedScroll: true,
    });
    window.__lenis = lenis;
    return () => {
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);
  return null;
}
