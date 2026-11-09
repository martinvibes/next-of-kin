"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { renderQuestion } from "@/domain/questions";
import { walletBaseline } from "@/domain/drift";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import { formatAmount, formatUsd } from "@/domain/format";
import type { ConfirmResolution, Question } from "@/domain/types";
import { ApiFailure } from "@/lib/client";
import { Receipt } from "@/components/Receipt";
import type { OwnerCtx } from "./useOwner";
import { WalletForm } from "./WalletsPanel";

function useQueue(o: OwnerCtx) {
  const questions = useMemo(() => o.scan?.questions ?? [], [o.scan]);
  const [idx, setIdx] = useState(0);
  const ids = questions.map((q) => q.id).join("|");
  useEffect(() => setIdx(0), [ids]);
  const i = Math.min(idx, Math.max(0, questions.length - 1));
  return { questions, idx: i, setIdx, current: questions[i] as Question | undefined };
}
type Queue = ReturnType<typeof useQueue>;

/** The agent's current question. Compact on the overview; full on the Agent view. */
export function AgentPanel({ o, compact, onOpenAgent, queue }: { o: OwnerCtx; compact?: boolean; onOpenAgent?: () => void; queue?: Queue }) {
  const own = useQueue(o);
  const { questions, idx, setIdx, current } = queue ?? own;
  const wallets = o.state?.state.wallets ?? [];

  if (!o.state || !o.dec) return <Skeleton />;
  if (wallets.length === 0) return <FirstWallet o={o} />;
  if (!o.scan) return <Skeleton label="Reading your wallets through Tatum…" />;
  if (!current) return <AllCovered o={o} />;
  return (
    <QuestionCard
      key={current.id}
      q={current}
      o={o}
      position={idx + 1}
      total={questions.length}
      onSkip={questions.length > 1 ? () => setIdx((i) => (i + 1) % questions.length) : undefined}
      footer={
        compact && questions.length > 1 && onOpenAgent ? (
          <button type="button" onClick={onOpenAgent} className="flex w-full items-center justify-between gap-3 border-t border-line px-5 py-3 text-[0.8125rem] text-fg-2 transition-colors hover:bg-black/[0.04] hover:text-fg sm:px-6">
            <span>
              {questions.length - 1} more {questions.length - 1 === 1 ? "question" : "questions"} in the queue
            </span>
            <span className="inline-flex items-center gap-1 text-mint">
              Open agent <ArrowRight className="size-3.5" />
            </span>
          </button>
        ) : null
      }
    />
  );
}

/** Full agent view: the card, the receipts, and the ranked queue. */
export function AgentView({ o }: { o: OwnerCtx }) {
  const queue = useQueue(o);
  const mock = o.status.memory.mode === "mock";
  const { questions, current } = queue;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        <AgentPanel o={o} queue={queue} />
        {o.receipts.length > 0 && (
          <div className="space-y-2 pt-2" aria-label="Recent memories">
            <p className="px-1 text-[0.75rem] text-fg-3">Just written</p>
            {o.receipts.slice(0, 4).map((r) => (
              <Receipt key={r.memory.id} stored={r} mock={mock} />
            ))}
          </div>
        )}
      </div>

      <aside className="card min-w-0 overflow-hidden lg:sticky lg:top-24" aria-labelledby="queue-title">
        <div className="card-head">
          <h2 id="queue-title" className="card-title">
            Queue
          </h2>
          <span className="t-num text-[0.75rem] text-fg-3">{questions.length} open</span>
        </div>
        {questions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-2">{o.scan ? "Nothing to ask right now. The agent asks again if anything moves on-chain." : "Waiting for the first scan…"}</p>
        ) : (
          <ol className="max-h-[420px] overflow-y-auto py-1.5">
            {questions.map((q, i) => {
              const active = q.id === current?.id;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => queue.setIdx(i)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-start gap-3 px-5 py-2.5 text-left transition-colors ${active ? "bg-black/[0.04]" : "hover:bg-black/[0.04]"}`}
                  >
                    <span className={`t-num mt-0.5 grid size-5 shrink-0 place-items-center rounded-md text-[0.68rem] font-semibold ${active ? "bg-mint text-mint-ink" : "bg-black/[0.04] text-fg-3"}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 text-[0.8125rem] leading-snug ${active ? "text-fg" : "text-fg-2"}`}>{renderQuestion(q, { walletLabel: o.dec?.labels[q.walletId] }).title}</span>
                      <span className="mt-1 block">
                        <ImpactChip q={q} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <p className="border-t border-line px-5 py-3.5 text-[0.75rem] leading-relaxed text-fg-3">
          Ranked by money at stake: drift first, then the answer that raises readiness most, then each question&rsquo;s share of the gap. No LLM: the same wallets always give the same order.
        </p>
      </aside>
    </div>
  );
}

function ImpactChip({ q }: { q: Question }) {
  if (q.kind === "drift")
    return (
      <span className="pill pill-amber">
        <AlertTriangle /> Needs a check
      </span>
    );
  if (q.impactPct > 0) return <span className="pill pill-mint t-num">+{Math.round(q.impactPct)}% readiness</span>;
  if (q.sharePct > 0)
    return (
      <span className="pill pill-violet t-num" title="This answer's share of what your heir couldn't recover yet. An asset counts once where, how and who are all known.">
        {Math.max(1, Math.round(q.sharePct))}% of the gap
      </span>
    );
  if (q.usdAtStake > 0) return <span className="pill pill-muted t-num">{formatUsd(q.usdAtStake)}</span>;
  return <span className="pill pill-muted">For completeness</span>;
}

const FIELD_LABEL: Record<Question["kind"], string> = {
  where: "Where",
  how: "How",
  "how-stake": "How · staked",
  who: "Who",
  drift: "Drift",
  "new-asset": "New asset",
};

function QuestionCard({ q, o, position, total, onSkip, footer }: { q: Question; o: OwnerCtx; position: number; total: number; onSkip?: () => void; footer?: React.ReactNode }) {
  const label = o.dec?.labels[q.walletId];
  const r = renderQuestion(q, { walletLabel: label || undefined });
  const [text, setText] = useState(r.prefill ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const secret = text.length > 20 ? detectSecret(text) : { blocked: false };
  const asset = q.assetKey ? o.scan?.scan.assets.find((a) => a.key === q.assetKey) : undefined;
  const drift = q.kind === "drift";

  async function answer() {
    if (!q.field || !o.scan) return;
    setBusy(true);
    setErr(null);
    try {
      const value = await o.enc(text);
      const baseline = q.assetKey ? (asset ? { [asset.key]: asset.amountRaw } : undefined) : walletBaseline(o.scan.scan.assets, q.walletId);
      await o.write({ ...o.newMeta(), kind: "fact", target: q.target, field: q.field, value, baseline }, { cause: `answered ${q.field} · ${q.context.shortAddress}` });
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Couldn't save that answer.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(resolution: ConfirmResolution) {
    const assetKey = q.assetKey ?? q.target;
    const amount = q.context.drift?.current ?? asset?.amountRaw ?? "0";
    setBusy(true);
    setErr(null);
    try {
      const note = resolution === "moved" && text.trim() ? await o.enc(text) : undefined;
      await o.write(
        { ...o.newMeta(), kind: "confirm", assetKey, amount, resolution, ...(note ? { note } : {}) },
        { cause: drift ? `resolved drift · ${q.context.drift?.symbol ?? ""} · ${q.context.shortAddress}` : `reviewed new ${q.context.symbol ?? "asset"}` },
      );
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`card overflow-hidden ${drift ? "glow-amber border-amber/25" : "glow-violet"}`} aria-labelledby={`q-${q.id}`}>
      <header className="card-head">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${drift ? "bg-amber-wash text-amber" : "bg-mint-wash text-mint"}`}>
            {drift ? <AlertTriangle className="size-3.5" /> : <Sparkles className="size-3.5" />}
          </span>
          <span className="truncate text-[0.8125rem] font-medium">
            {drift ? "Something changed on-chain" : "Agent"}
            <span className="font-normal text-fg-3">
              {" "}
              · {position} of {total}
            </span>
          </span>
        </span>
        <ImpactChip q={q} />
      </header>

      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="pill pill-muted">{FIELD_LABEL[q.kind]}</span>
          <span className="pill pill-muted">
            {label || (q.context.chain === "sui" ? "Sui wallet" : "Ethereum wallet")} <span className="t-mono font-normal text-fg-3">{q.context.shortAddress}</span>
          </span>
          {q.context.amount !== undefined && q.context.symbol && <span className="pill pill-sky t-num">{formatAmount(q.context.amount, q.context.symbol)}</span>}
        </div>
        <h3 id={`q-${q.id}`} className="text-[1.2rem] leading-snug font-semibold tracking-[-0.02em] sm:text-[1.4rem]">
          {r.title}
        </h3>
        <p className="mt-2 text-[0.875rem] text-fg-2">{r.hint}</p>

        {q.field ? (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!secret.blocked && text.trim()) answer();
            }}
          >
            <label htmlFor={`a-${q.id}`} className="sr-only">
              Your answer
            </label>
            <textarea
              id={`a-${q.id}`}
              ref={area}
              className="input min-h-[6.5rem]"
              rows={3}
              value={text}
              placeholder={r.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!secret.blocked && text.trim()) answer();
                }
              }}
              aria-invalid={secret.blocked || undefined}
              aria-describedby={`h-${q.id}`}
            />
            <p id={`h-${q.id}`} className={`mt-2 flex items-center gap-1.5 text-[0.75rem] ${secret.blocked ? "font-medium text-rose" : "text-fg-3"}`} role={secret.blocked ? "alert" : undefined}>
              {secret.blocked ? (
                <>
                  <AlertTriangle className="size-3.5 shrink-0" /> {SECRET_MESSAGE}
                </>
              ) : (
                <>
                  <Lock className="size-3 shrink-0" /> Encrypted in this browser before it&rsquo;s sent.
                  <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
                    <span className="kbd">⌘</span>
                    <span className="kbd">↵</span> to save
                  </span>
                </>
              )}
            </p>
            {err && <ErrorLine>{err}</ErrorLine>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" disabled={busy || !text.trim() || secret.blocked}>
                {busy ? "Encrypting and saving…" : r.cta}
              </button>
              {onSkip && (
                <button type="button" className="btn btn-ghost" onClick={onSkip} disabled={busy}>
                  Ask me later
                </button>
              )}
            </div>
          </form>
        ) : drift ? (
          <div className="mt-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => confirm("accurate")}>
                It&rsquo;s still accurate
              </button>
              <button type="button" className={`btn ${moving ? "btn-primary" : "btn-secondary"}`} disabled={busy} onClick={() => setMoving(true)} aria-expanded={moving}>
                I moved it
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => confirm("spent")}>
                I spent or sold it
              </button>
            </div>
            {moving && (
              <form
                className="mt-4 animate-rise"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!secret.blocked) confirm("moved");
                }}
              >
                <label htmlFor={`m-${q.id}`} className="label">
                  Where did it go? <span className="font-normal text-fg-3">Optional, encrypted</span>
                </label>
                <input id={`m-${q.id}`} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={r.placeholder} autoFocus />
                {secret.blocked && <ErrorLine>{SECRET_MESSAGE}</ErrorLine>}
                <button className="btn btn-primary mt-3" disabled={busy || secret.blocked}>
                  {busy ? "Saving…" : "Confirm I moved it"}
                </button>
              </form>
            )}
            {err && <ErrorLine>{err}</ErrorLine>}
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => confirm("accurate")}>
              {busy ? "Saving…" : r.cta}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-ghost" onClick={onSkip} disabled={busy}>
                Ask me later
              </button>
            )}
            {err && <ErrorLine>{err}</ErrorLine>}
          </div>
        )}
      </div>
      {footer}
    </article>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-rose/20 bg-rose-wash px-3 py-2 text-[0.8125rem] text-rose" role="alert">
      {children}
    </p>
  );
}

function Skeleton({ label = "Opening your vault…" }: { label?: string }) {
  return (
    <div className="card p-6" role="status" aria-live="polite">
      <p className="text-[0.8125rem] text-fg-3 animate-pulse-soft">{label}</p>
      <div className="mt-5 space-y-2.5" aria-hidden="true">
        <div className="skeleton h-6 w-4/5" />
        <div className="skeleton h-6 w-3/5" />
        <div className="skeleton mt-6 h-24" />
      </div>
    </div>
  );
}

function FirstWallet({ o }: { o: OwnerCtx }) {
  return (
    <article className="card glow-mint overflow-hidden" aria-labelledby="first-wallet">
      <header className="card-head">
        <span className="flex items-center gap-2.5 text-[0.8125rem] font-medium">
          <span className="grid size-7 place-items-center rounded-lg bg-mint-wash text-mint">
            <Sparkles className="size-3.5" />
          </span>
          Agent · first things first
        </span>
      </header>
      <div className="px-5 pt-5 pb-6 sm:px-6">
        <h3 id="first-wallet" className="text-[1.3rem] leading-snug font-semibold tracking-[-0.02em]">
          Which wallet should your heir know about?
        </h3>
        <p className="mt-2 text-[0.875rem] text-fg-2">Paste a public address. The agent reads it through Tatum and works out which questions protect the most money.</p>
        <WalletForm o={o} className="mt-5" />
      </div>
    </article>
  );
}

function AllCovered({ o }: { o: OwnerCtx }) {
  const heir = o.dec?.heirName;
  return (
    <article className="card glow-mint flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-mint-wash text-mint">
        <CheckCircle2 className="size-6" />
      </span>
      <h3 className="mt-4 text-[1.3rem] font-semibold tracking-[-0.02em]">Nothing left to ask.</h3>
      <p className="mt-2 max-w-md text-[0.875rem] text-fg-2">
        {heir ? `${heir} would` : "Your heir would"} know where, how and for whom for everything the agent can see. Keep checking in; it asks again if anything moves on-chain.
      </p>
      {!o.dec?.letter && <p className="mt-4 text-[0.8125rem] text-amber">One more thing: a few words in your letter mean more than any of this.</p>}
    </article>
  );
}
