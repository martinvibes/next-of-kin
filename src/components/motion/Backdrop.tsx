import Image from "next/image";

/**
 * The fog-and-tree scene from the landing hero, faded into the page.
 * Sits behind the top of inner pages so every screen feels like the same place.
 */
export function Backdrop({ strength = 1, height = 560, className = "" }: { strength?: number; height?: number; className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_35%,transparent)] ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 animate-[kenBurns_3.2s_var(--ease-out)_both]" style={{ opacity: 0.55 * strength }}>
        <Image src="/scene/tree.webp" alt="" fill sizes="100vw" className="object-cover object-[68%_62%] blur-[1.5px] saturate-[0.8]" />
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[18%] left-[-12%] h-[46%] w-[70%] rounded-[50%] bg-white/70 blur-[64px] [animation:fogDrift_30s_ease-in-out_infinite_alternate]" />
        <div className="absolute top-[40%] right-[-18%] h-[38%] w-[64%] rounded-[50%] bg-white/60 blur-[72px] [animation:fogDrift_38s_ease-in-out_infinite_alternate-reverse]" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(250,250,250,0.55),rgba(250,250,250,0.35)_40%,#fafafa)]" />
    </div>
  );
}

/** Four crosshair marks at the corners of a framed block. The parent must be `relative`. */
export function Corners({ light }: { light?: boolean }) {
  const c = `plus ${light ? "plus-light" : ""}`;
  return (
    <>
      <span className={`${c} top-0 left-0`} aria-hidden="true" />
      <span className={`${c} top-0 left-full`} aria-hidden="true" />
      <span className={`${c} top-full left-0`} aria-hidden="true" />
      <span className={`${c} top-full left-full`} aria-hidden="true" />
    </>
  );
}
