import type { StatusResponse } from "@/lib/api-types";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Backdrop } from "@/components/motion/Backdrop";

/** Full-height, centred layout for unlock and setup, under the same sky as the landing page. */
export function AuthLayout({ status, children, wide, current }: { status: Pick<StatusResponse, "memory" | "chain"> | null; children: React.ReactNode; wide?: boolean; current?: "owner" | "setup" }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip bg-bg">
      <ModeBanner status={status} />
      <SiteHeader overlay current={current} />
      <div className="relative isolate">
        <Backdrop height={760} />
        <main id="main" className={`relative mx-auto flex min-h-[100svh] w-full flex-col justify-center px-4 pt-[calc(73px+32px)] pb-20 sm:px-6 ${wide ? "max-w-5xl" : "max-w-[480px]"}`}>
          {children}
        </main>
      </div>
      <SiteFooter cta={false} />
    </div>
  );
}
