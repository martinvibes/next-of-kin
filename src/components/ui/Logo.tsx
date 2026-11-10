import Link from "next/link";

const KEYHOLE = "M16 7.5a4.75 4.75 0 0 1 2.35 8.88L19.6 24.5H12.4l1.25-8.12A4.75 4.75 0 0 1 16 7.5z";

/** A keyhole cut from a solid tile: the vault, and the one way in. */
export function LogoMark({ size = 26, className = "", light }: { size?: number; className?: string; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill={light ? "#f4f4f4" : "#0a0a0a"} />
      <path d={KEYHOLE} fill={light ? "#0a0a0a" : "#fff"} />
    </svg>
  );
}

/** Mark plus logotype. */
export function Wordmark({ href = "/", size = 24, tag, light }: { href?: string; size?: number; tag?: React.ReactNode; light?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-sm" aria-label="Next of Kin, home">
      <LogoMark size={Math.round(size * 1.12)} light={light} className="transition-transform duration-500 ease-[var(--ease-out)] group-hover:-rotate-6" />
      <span className={`leading-none font-semibold tracking-[-0.035em] whitespace-nowrap ${light ? "text-[#ececec]" : "text-fg"}`} style={{ fontSize: size }}>
        Next of Kin
      </span>
      {tag}
    </Link>
  );
}
