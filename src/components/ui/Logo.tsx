import Link from "next/link";

/** Two linked rings on an ink tile: kin, and the chain between them. Used where a square mark is needed. */
export function LogoMark({ size = 26, className = "", light }: { size?: number; className?: string; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <rect x="0" y="0" width="32" height="32" rx="8" fill={light ? "#fff" : "#0c090c"} />
      <circle cx="12.7" cy="16" r="5.4" fill="none" stroke={light ? "#0c090c" : "#fff"} strokeWidth="2.2" />
      <circle cx="19.3" cy="16" r="5.4" fill="none" stroke={light ? "#0c090c" : "#fff"} strokeWidth="2.2" />
      <circle cx="26" cy="6" r="2.2" fill="#ff6800" />
    </svg>
  );
}

/** The serif logotype. */
export function Wordmark({ href = "/", size = 25, tag, light }: { href?: string; size?: number; tag?: React.ReactNode; light?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-sm" aria-label="Next of Kin, home">
      <span
        className={`font-[family-name:var(--font-display)] leading-none font-semibold tracking-[-0.045em] whitespace-nowrap [font-variation-settings:'opsz'_72] ${light ? "text-[#d9d4da]" : "text-fg"}`}
        style={{ fontSize: size }}
      >
        Next of Kin
      </span>
      {tag}
    </Link>
  );
}
