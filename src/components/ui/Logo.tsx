import Link from "next/link";
import { useId } from "react";

/** Two linked rings on a mint-to-violet tile: kin, and the chain between them. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5ce9c6" />
          <stop offset="1" stopColor="#a99bff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#lg-${id})`} />
      <circle cx="12.6" cy="16" r="5.6" fill="none" stroke="#07080a" strokeWidth="2.5" />
      <circle cx="19.4" cy="16" r="5.6" fill="none" stroke="#07080a" strokeWidth="2.5" />
    </svg>
  );
}

export function Wordmark({ href = "/", size = 28, tag }: { href?: string; size?: number; tag?: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Next of Kin, home">
      <LogoMark size={size} className="transition-transform duration-300 group-hover:scale-105" />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] whitespace-nowrap text-fg">Next of Kin</span>
      {tag}
    </Link>
  );
}
