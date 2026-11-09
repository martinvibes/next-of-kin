import Link from "next/link";

/** Two linked rings, white on an ink tile: kin, and the chain between them. */
export function LogoMark({ size = 26, className = "", light }: { size?: number; className?: string; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <rect x="0" y="0" width="32" height="32" rx="8" fill={light ? "#fff" : "#191816"} />
      <circle cx="12.7" cy="16" r="5.4" fill="none" stroke={light ? "#191816" : "#fff"} strokeWidth="2.2" />
      <circle cx="19.3" cy="16" r="5.4" fill="none" stroke={light ? "#191816" : "#fff"} strokeWidth="2.2" />
      <circle cx="26" cy="6" r="2.2" fill="#ff5b14" />
    </svg>
  );
}

export function Wordmark({ href = "/", size = 26, tag, light }: { href?: string; size?: number; tag?: React.ReactNode; light?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Next of Kin, home">
      <LogoMark size={size} light={light} />
      <span className={`font-[family-name:var(--font-display)] text-[1.3rem] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap ${light ? "text-white" : "text-fg"}`}>Next of Kin</span>
      {tag}
    </Link>
  );
}
