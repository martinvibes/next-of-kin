import Link from "next/link";
import type { StatusResponse } from "@/lib/api-types";
import { ModeBanner } from "@/components/ModeBanner";
import { Wordmark } from "./Logo";

/** Full-height, centred layout for unlock and setup. */
export function AuthLayout({ status, children, wide }: { status: Pick<StatusResponse, "memory" | "chain"> | null; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <ModeBanner status={status} />
      <div className="dots-bg pointer-events-none absolute inset-x-0 top-0 h-[520px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,#000_20%,transparent_75%)]" aria-hidden="true" />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link href="/heir" className="tab">
            For heirs
          </Link>
          <Link href="/proof" className="tab">
            Proof
          </Link>
        </nav>
      </header>
      <main id="main" className={`relative mx-auto flex w-full flex-1 flex-col justify-center px-4 py-10 sm:px-6 ${wide ? "max-w-5xl" : "max-w-[440px]"}`}>
        {children}
      </main>
    </div>
  );
}
