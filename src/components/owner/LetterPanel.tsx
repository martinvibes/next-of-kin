"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Lock, PenLine } from "lucide-react";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import type { LetterMemory } from "@/domain/types";
import { ApiFailure } from "@/lib/client";
import { Receipt } from "@/components/Receipt";
import type { OwnerCtx } from "./useOwner";

/** The human part. Written on the one lit sheet in the room; encrypted here, released with the guide. */
export function LetterView({ o }: { o: OwnerCtx }) {
  const saved = o.dec?.letter ?? "";
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => setText(saved), [saved]);

  const secret = detectSecret(text).blocked;
  const dirty = text.trim() !== saved.trim();
  const heir = o.dec?.heirName || "your heir";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const receipt = o.receipts.find((r) => r.memory.kind === "letter");

  async function save() {
    if (secret || !dirty || !text.trim()) return;
    setBusy(true);
    try {
      const memory: LetterMemory = { ...o.newMeta(), kind: "letter", value: await o.enc(text) };
      await o.write(memory, { rescan: false });
      setSavedAt(Date.now());
    } catch (e) {
      o.setError(e instanceof ApiFailure ? e.message : "Couldn't save the letter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="paper min-w-0 px-6 py-8 focus-within:shadow-[0_0_0_2px_rgba(25,24,22,0.35),0_30px_80px_-30px_rgba(0,0,0,0.8)] sm:px-12 sm:py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 pb-4 text-[0.8125rem] text-black/55">
          <span>
            For <span className="font-medium text-black/80">{o.dec?.heirName || "your heir"}</span>
          </span>
          <span>Opens only if you stop checking in</span>
        </div>
        <label htmlFor="letter" className="sr-only">
          Letter to {heir}
        </label>
        <textarea
          id="letter"
          className="paper-ruled t-letter mt-6 block min-h-[340px] w-full resize-y bg-transparent text-[1.08rem] leading-[1.85em] text-[#1b1f27] placeholder:text-black/35 focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
          placeholder={`Dear ${o.dec?.heirName || "…"},\n\nIf you're reading this, I've stopped checking in. Everything you need is below. Take your time.`}
          aria-invalid={secret}
          maxLength={8000}
        />
        {o.dec?.ownerName && <p className="mt-6 font-[family-name:var(--font-hand)] text-[2.6rem] leading-none text-[#1b1f27]/85">{o.dec.ownerName}</p>}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="card overflow-hidden" aria-labelledby="letter-save">
          <div className="card-head">
            <h2 id="letter-save" className="card-title">
              <PenLine className="size-4" aria-hidden="true" />
              Your letter
            </h2>
            <span className="t-num text-[0.75rem] text-fg-3">{words} words</span>
          </div>
          <div className="p-5">
            {secret ? (
              <p className="flex gap-2 rounded-lg border border-rose/20 bg-rose-wash px-3 py-2 text-[0.8125rem] text-rose" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {SECRET_MESSAGE}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-[0.8125rem] text-fg-2" role="status">
                {savedAt && !dirty ? (
                  <>
                    <Check className="size-4 text-mint" /> Saved. Encrypted before it left this browser.
                  </>
                ) : dirty ? (
                  <>
                    <span className="dot bg-amber" /> Unsaved changes
                  </>
                ) : saved ? (
                  <>
                    <Lock className="size-3.5 text-mint" /> Kept as an encrypted memory.
                  </>
                ) : (
                  "Not written yet."
                )}
              </p>
            )}
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={save} disabled={busy || secret || !dirty || !text.trim()}>
              {busy ? "Encrypting…" : saved ? "Save changes" : "Save letter"}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1 text-[0.72rem] text-fg-3">
              <span className="kbd">⌘</span>
              <span className="kbd">↵</span> saves from the page
            </p>
          </div>
        </section>
        {receipt && <Receipt stored={receipt} mock={o.status.memory.mode === "mock"} />}
        <section className="card p-5 text-[0.8125rem] text-fg-2">
          <p className="font-medium text-fg">What helps most</p>
          <ul className="mt-2.5 space-y-2">
            <li>Say who to call first, and who to trust.</li>
            <li>Name anything the guide can&rsquo;t see: exchanges, cards, paper notes.</li>
            <li>Never a recovery phrase, PIN or password. The agent refuses them.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
