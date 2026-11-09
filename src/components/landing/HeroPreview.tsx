import { HeartPulse, Lock, MessageSquareText } from "lucide-react";
import { Meter, Ring } from "@/components/ui/Ring";

/**
 * A still of the owner dashboard, with sample content.
 * Labelled "Example" because none of it is real data.
 */
export function HeroPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[560px] lg:mr-0" aria-label="Example of the owner dashboard">
      <div className="pointer-events-none absolute -inset-10 rounded-[48px] bg-[radial-gradient(60%_50%_at_60%_40%,rgba(92,233,198,0.13),transparent_70%)]" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[22px] border border-line-2 bg-panel/90 shadow-pop backdrop-blur">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-[0.8125rem] font-medium">Overview</span>
          <span className="pill pill-muted">Example</span>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="card-2 flex flex-col items-center justify-between gap-4 px-4 pt-5 pb-4">
            <Ring value={72} size={148} stroke={10} label="Example readiness: 72%">
              <span className="t-num text-[2rem] leading-none font-semibold tracking-[-0.04em]">72%</span>
              <span className="mt-1 text-[0.7rem] text-fg-3">ready</span>
            </Ring>
            <div className="w-full space-y-2.5">
              <Meter value={90} tone="mint" label="Where the keys are" />
              <Meter value={64} tone="violet" label="How to open them" />
              <Meter value={58} tone="sky" label="Who receives what" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="card-2 glow-mint flex-1 p-4">
              <p className="flex items-center gap-1.5 text-[0.72rem] text-mint">
                <MessageSquareText className="size-3.5" aria-hidden="true" /> Next question
              </p>
              <p className="mt-2 text-[0.95rem] leading-snug font-medium">How would someone open the staked SUI in Savings?</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="pill pill-sky">Sui</span>
                <span className="pill pill-muted">412 SUI staked</span>
              </div>
              <div className="mt-3 rounded-lg border border-line-2 bg-bg-2 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-fg-2">
                Open Slush, go to Staking and withdraw. It arrives next epoch, about a day.
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.7rem] text-fg-3">
                  <Lock className="size-3" aria-hidden="true" /> Encrypted before it leaves
                </span>
                <span className="btn btn-primary btn-sm pointer-events-none" aria-hidden="true">
                  Save answer
                </span>
              </div>
            </div>

            <div className="card-2 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.72rem] text-fg-3">
                  <HeartPulse className="size-3.5 text-mint" aria-hidden="true" /> Next check-in
                </span>
                <span className="t-num text-[0.8125rem] font-semibold">in 6 days</span>
              </div>
              <div className="relative mt-2 h-[34px]" aria-hidden="true">
                <svg viewBox="0 0 240 34" className="size-full" preserveAspectRatio="none">
                  <path
                    d="M0 20 H40 l4 -12 l5 22 l4 -10 H112 l4 -12 l5 22 l4 -10 H168"
                    fill="none"
                    stroke="var(--color-mint)"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path d="M168 20 H240" fill="none" stroke="var(--color-fg-3)" strokeWidth="1.2" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="absolute size-2 -translate-1/2 rounded-full bg-mint shadow-[0_0_0_4px_rgba(92,233,198,0.18)]" style={{ left: "70%", top: `${(20 / 34) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
