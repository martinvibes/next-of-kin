"use client";

import { useEffect, useRef } from "react";

/**
 * The landing's one moving thing: a halftone field with a heartbeat drawn
 * through it, like an oscilloscope. The trace fades behind the scan head, so
 * it reads as "still alive" without a word. The pointer swells the dots under it.
 * Static (fully drawn, no loop) for reduced motion.
 */

const g = (u: number, m: number, s: number) => Math.exp(-((u - m) * (u - m)) / (2 * s * s));
/** One beat, phase 0..1 → -0.3..1 (up is positive). */
function ecg(u: number) {
  return 0.12 * g(u, 0.16, 0.028) - 0.14 * g(u, 0.268, 0.008) + 1.0 * g(u, 0.29, 0.011) - 0.3 * g(u, 0.315, 0.01) + 0.24 * g(u, 0.52, 0.042);
}

export function Pulse({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let S = 11;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };
    const t0 = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      S = W < 640 ? 9 : 11;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    };

    const draw = (ms: number) => {
      const t = ms / 1000;
      const period = Math.max(260, Math.min(380, W / 3.6));
      const speed = period * 0.95; // ~57 bpm
      const loop = W + period;
      const head = reduce ? W * 0.72 : (t * speed) % loop;
      const cy = H * 0.46;
      const amp = H * 0.38;
      const traceY = (x: number) => cy - ecg((((x % period) + period) % period) / period) * amp;

      ctx.clearRect(0, 0, W, H);
      const BUCKETS = 7;
      const ink: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
      const ember = new Path2D();

      const cols = Math.ceil(W / S) + 1;
      const rows = Math.ceil(H / S) + 1;
      const ox = (W - (cols - 1) * S) / 2;
      const oy = (H - (rows - 1) * S) / 2;

      for (let i = 0; i < cols; i++) {
        const x = ox + i * S;
        // the trace's vertical extent across this column, so steep strokes still fill
        let lo = Infinity;
        let hi = -Infinity;
        for (let k = -2; k <= 2; k++) {
          const y = traceY(x + (k * S) / 4);
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
        const behind = head - x;
        const age = reduce ? 0.6 : (behind >= 0 ? behind : behind + loop) / speed;
        const life = reduce ? 0.8 : 0.3 + 0.7 * Math.exp(-age / 2.2);
        const fresh = !reduce && age < 0.22;

        for (let j = 0; j < rows; j++) {
          const y = oy + j * S;
          const d = y < lo ? lo - y : y > hi ? y - hi : 0;
          const tr = Math.exp(-(d * d) / (2 * 4.2 * 4.2)) * life;

          // halftone texture that drifts slowly
          const n = 0.5 + 0.5 * Math.sin(x * 0.011 + t * 0.25) * Math.cos(y * 0.035 - t * 0.18 + x * 0.004);
          let r = 0.55 + 0.55 * n * n;
          let a = 0.1 + 0.12 * n;

          if (tr > 0.04) {
            r = Math.max(r, 0.7 + tr * (S * 0.3));
            a = Math.max(a, 0.18 + 0.82 * tr);
          }

          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const md = Math.sqrt(dx * dx + dy * dy);
          if (md < 120) {
            const k = 1 - md / 120;
            r += k * k * 2.6;
            a = Math.max(a, 0.14 + 0.5 * k);
          }

          if (fresh && tr > 0.35) {
            ember.moveTo(x + r, y);
            ember.arc(x, y, r, 0, Math.PI * 2);
          } else {
            const b = Math.min(BUCKETS - 1, Math.floor(a * BUCKETS));
            ink[b].moveTo(x + r, y);
            ink[b].arc(x, y, r, 0, Math.PI * 2);
          }
        }
      }

      for (let b = 0; b < BUCKETS; b++) {
        ctx.fillStyle = `rgba(25,24,22,${((b + 0.5) / BUCKETS).toFixed(3)})`;
        ctx.fill(ink[b]);
      }
      ctx.fillStyle = "#ff5b14";
      ctx.fill(ember);
    };

    const tick = (now: number) => {
      if (visible) draw(now - t0);
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      if (reduce) draw(0);
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
      if (reduce) draw(0);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={`block h-full w-full ${className}`} aria-hidden="true" />;
}
