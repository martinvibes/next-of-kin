"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { Corners } from "@/components/motion/Backdrop";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[nok] page error", error);
  }, [error]);

  return (
    <AuthLayout status={null}>
      <div className="card hero-rise hero-rise--1 p-7 shadow-[var(--shadow-pop)] sm:p-8" role="alert">
        <Corners />
        <span className="pill pill-rose">Page error</span>
        <h1 className="t-display mt-5 text-[2.1rem] leading-[1.06]">This page stopped working</h1>
        <p className="mt-3 text-[0.9375rem] text-fg-2">
          Something broke while it was loading. Your vault and its memories are stored outside this page and weren&rsquo;t touched.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-primary btn-lg sm:flex-1 cursor-pointer" onClick={reset}>
            <RefreshCw /> Try again
          </button>
          <Link href="/" className="btn btn-secondary btn-lg sm:flex-1">
            Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-5 text-center text-[0.75rem] text-fg-3">
            Reference for the server logs: <span className="t-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
