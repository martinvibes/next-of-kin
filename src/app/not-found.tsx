import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { Corners } from "@/components/motion/Backdrop";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <AuthLayout status={null}>
      <div className="card hero-rise hero-rise--1 p-7 shadow-[var(--shadow-pop)] sm:p-8">
        <Corners />
        <span className="pill pill-muted t-num">404</span>
        <h1 className="t-display mt-5 text-[2.1rem] leading-[1.06]">This page isn&rsquo;t here</h1>
        <p className="mt-3 text-[0.9375rem] text-fg-2">
          The link may be mistyped or out of date. If you were told a letter was left for you, open it from the heir page.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="btn btn-primary btn-lg sm:flex-1">
            Go home <ArrowRight />
          </Link>
          <Link href="/heir" className="btn btn-secondary btn-lg sm:flex-1">
            I was left a letter
          </Link>
        </div>
        <p className="mt-5 text-center text-[0.8125rem] text-fg-3">
          Checking how it works?{" "}
          <Link href="/proof" className="font-medium text-fg underline decoration-line-2 underline-offset-4 hover:decoration-fg">
            See every memory on the proof page
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
