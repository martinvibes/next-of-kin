"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderQuestion } from "@/domain/questions";
import { walletBaseline } from "@/domain/drift";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import { formatUsd } from "@/domain/format";
import type { ConfirmResolution, Question } from "@/domain/types";
import { ApiFailure } from "@/lib/client";
import { Receipt } from "@/components/Receipt";
import { Seal } from "@/components/Seal";
import type { OwnerCtx } from "./useOwner";
import { WalletForm } from "./WalletsPanel";

export function QuestionArea({ o }: { o: OwnerCtx }) {
  const questions = useMemo(() => o.scan?.questions ?? [], [o.scan]);
  const [idx, setIdx] = useState(0);
  const ids = questions.map((q) => q.id).join("|");
  useEffect(() => setIdx(0), [ids]);

  const mock = o.status.memory.mode === "mock";
  const wallets = o.state?.state.wallets ?? [];
  const current = questions[Math.min(idx, Math.max(0, questions.length - 1))];

  let main: React.ReactNode;
  if (!o.state || !o.dec) main = <SheetSkeleton />;
  else if (wallets.length === 0) main = <FirstWallet o={o} />;
  else if (!o.scan) main = <SheetSkeleton label="Scanning your wallets through Tatum…" />;
  else if (!current) main = <AllCovered o={o} />;
  else
    main = (
      <QuestionSheet
        key={current.id}
        q={current}
        o={o}
        position={Math.min(idx, questions.length - 1) + 1}
        total={questions.length}
        onSkip={questions.length > 1 ? () => setIdx((i) => (i + 1) % questions.length) : undefined}
      />
    );

  return (
    <div>
      {main}
      {o.receipts.length > 0 && (
        <div className="mt-5 space-y-2" aria-label="Recent memories">
          {o.receipts.slice(0, 3).map((r) => (
            <Receipt key={r.memory.id} stored={r} mock={mock} />
          ))}
        </div>
      )}
      {questions.length > 1 && o.dec && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-ink">Up next</h2>
          <ul className="mt-3 divide-y divide-rule-soft border-y border-rule-soft">
            {questions.map((q, i) =>
              q.id === current?.id ? null : (
                <li key={q.id}>
                  <button type="button" onClick={() => setIdx(i)} className="flex w-full items-center justify-between gap-4 py-3 text-left text-[0.9375rem] hover:bg-sheet/60">
                    <span className="line-clamp-1 text-ink-2">{renderQuestion(q, { walletLabel: o.dec!.labels[q.walletId] }).title}</span>
                    <ImpactChip q={q} subtle />
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImpactChip({ q, subtle }: { q: Question; subtle?: boolean }) {
  const base = "shrink-0 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold t-num";
  if (q.kind === "drift") return <span className={`${base} bg-claret-wash text-claret`}>Needs a check</span>;
  if (q.impactPct > 0) return <span className={`${base} ${subtle ? "text-moss" : "bg-moss-wash text-moss"}`}>+{Math.round(q.impactPct)}% readiness</span>;
  if (q.sharePct > 0)
    return (
      <span className={`${base} ${subtle ? "text-brass" : "bg-brass-wash text-brass"}`} title="This answer's share of what your heir couldn't recover yet. An asset counts once where, how and who are all known.">
        {Math.max(1, Math.round(q.sharePct))}% of the gap
      </span>
    );
  if (q.usdAtStake > 0) return <span className={`${base} ${subtle ? "text-ink-2" : "bg-sheet-2 text-ink-2"}`}>{formatUsd(q.usdAtStake)}</span>;
  return <span className={`${base} ${subtle ? "text-ink-3" : "bg-sheet-2 text-ink-3"}`}>for completeness</span>;
}

function QuestionSheet({ q, o, position, total, onSkip }: { q: Question; o: OwnerCtx; position: number; total: number; onSkip?: () => void }) {
  const label = o.dec?.labels[q.walletId];
  const r = renderQuestion(q, { walletLabel: label || undefined });
  const [text, setText] = useState(r.prefill ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const secret = text.length > 20 ? detectSecret(text) : { blocked: false };

  useEffect(() => {
    area.current?.focus({ preventScroll: true });
  }, []);

  const asset = q.assetKey ? o.scan?.scan.assets.find((a) => a.key === q.assetKey) : undefined;

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
        { cause: q.kind === "drift" ? `resolved drift · ${q.context.drift?.symbol ?? ""} · ${q.context.shortAddress}` : `reviewed new ${q.context.symbol ?? "asset"}` },
      );
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  const tone = q.kind === "drift" ? "border-claret" : "border-brass";
  return (
    <article className="sheet animate-rise" aria-labelledby={`q-${q.id}`}>
      <header className="flex items-center justify-between gap-3 border-b border-rule-soft px-6 py-3.5 sm:px-8">
        <p className="text-[0.8125rem] text-ink-2">
          {q.kind === "drift" ? "Something changed on-chain" : `Question ${position} of ${total}`}
        </p>
        <ImpactChip q={q} />
      </header>
      <div className={`border-l-[3px] ${tone} mx-6 mt-6 pl-5 sm:mx-8`}>
        <h2 id={`q-${q.id}`} className="t-display text-[clamp(1.55rem,2.6vw,2rem)] leading-[1.15] text-balance">
          {r.title}
        </h2>
        <p className="mt-3 text-[0.9375rem] text-ink-2">{r.hint}</p>
      </div>

      <div className="px-6 pt-6 pb-6 sm:px-8 sm:pb-8">
        {q.field ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!secret.blocked && text.trim()) answer();
            }}
          >
            <label htmlFor={`a-${q.id}`} className="sr-only">
              Your answer
            </label>
            <div className="sheet-ruled rounded-md bg-sheet-2/60 px-4 py-2">
              <textarea
                id={`a-${q.id}`}
                ref={area}
                className="field field-letter min-h-[7.5rem]"
                rows={4}
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
            </div>
            <p id={`h-${q.id}`} className={`mt-2 text-[0.8125rem] ${secret.blocked ? "font-medium text-claret" : "text-ink-3"}`} role={secret.blocked ? "alert" : undefined}>
              {secret.blocked ? SECRET_MESSAGE : "Encrypted in this browser before it's sent. ⌘/Ctrl + Enter to save."}
            </p>
            {err && <ErrorLine>{err}</ErrorLine>}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" disabled={busy || !text.trim() || secret.blocked}>
                {busy ? "Sealing and saving…" : r.cta}
              </button>
              {onSkip && (
                <button type="button" className="btn btn-quiet" onClick={onSkip} disabled={busy}>
                  Ask me later
                </button>
              )}
            </div>
          </form>
        ) : q.kind === "drift" ? (
          <div>
            <div className="flex flex-wrap gap-2.5">
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
                className="mt-5 animate-rise"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!secret.blocked) confirm("moved");
                }}
              >
                <label htmlFor={`m-${q.id}`} className="label">
                  Where did it go? (optional, encrypted)
                </label>
                <input id={`m-${q.id}`} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder={r.placeholder} autoFocus />
                {secret.blocked && <ErrorLine>{SECRET_MESSAGE}</ErrorLine>}
                <button className="btn btn-primary mt-4" disabled={busy || secret.blocked}>
                  {busy ? "Saving…" : "Confirm I moved it"}
                </button>
              </form>
            )}
            {err && <ErrorLine>{err}</ErrorLine>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => confirm("accurate")}>
              {busy ? "Saving…" : r.cta}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-quiet" onClick={onSkip} disabled={busy}>
                Ask me later
              </button>
            )}
            {err && <ErrorLine>{err}</ErrorLine>}
          </div>
        )}
      </div>
    </article>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-md bg-claret-wash px-3 py-2 text-sm text-claret" role="alert">
      {children}
    </p>
  );
}

function SheetSkeleton({ label = "Opening your vault…" }: { label?: string }) {
  return (
    <div className="sheet p-8" role="status" aria-live="polite">
      <p className="text-sm text-ink-2 animate-pulse-soft">{label}</p>
      <div className="mt-6 space-y-3" aria-hidden="true">
        <div className="h-7 w-4/5 rounded bg-rule-soft" />
        <div className="h-7 w-3/5 rounded bg-rule-soft" />
        <div className="mt-8 h-24 rounded bg-sheet-2" />
      </div>
    </div>
  );
}

function FirstWallet({ o }: { o: OwnerCtx }) {
  return (
    <article className="sheet animate-rise" aria-labelledby="first-wallet">
      <header className="border-b border-rule-soft px-6 py-3.5 text-[0.8125rem] text-ink-2 sm:px-8">First things first</header>
      <div className="px-6 pt-6 pb-8 sm:px-8">
        <h2 id="first-wallet" className="t-display text-[clamp(1.55rem,2.6vw,2rem)] leading-[1.15]">
          Which wallet should your heir know about?
        </h2>
        <p className="mt-3 text-[0.9375rem] text-ink-2">
          Paste a public address. Next of Kin reads it through Tatum and works out which questions protect the most money.
        </p>
        <WalletForm o={o} className="mt-6" />
      </div>
    </article>
  );
}

function AllCovered({ o }: { o: OwnerCtx }) {
  const heir = o.dec?.heirName;
  return (
    <article className="sheet flex flex-col items-center px-8 py-12 text-center animate-rise">
      <Seal size={140} tone="moss" label="Fully covered" />
      <h2 className="t-display mt-6 text-[2rem] leading-tight">Nothing left to ask.</h2>
      <p className="mt-3 max-w-md text-ink-2">
        {heir ? `${heir} would` : "Your heir would"} know where, how and for whom for everything we can see. Keep checking in, and we&rsquo;ll ask again if anything moves.
      </p>
      {!o.dec?.letter && <p className="mt-5 text-sm text-ink">One more thing: a few words in your letter mean more than any of this.</p>}
    </article>
  );
}
