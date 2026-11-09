"use client";

import { useEffect, useState } from "react";
import { detectSecret, SECRET_MESSAGE } from "@/domain/seedGuard";
import type { LetterMemory } from "@/domain/types";
import { ApiFailure } from "@/lib/client";
import type { OwnerCtx } from "./useOwner";

/** The human part. Encrypted here, released with the guide. */
export function LetterPanel({ o }: { o: OwnerCtx }) {
  const saved = o.dec?.letter ?? "";
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => setText(saved), [saved]);

  const secret = detectSecret(text).blocked;
  const dirty = text.trim() !== saved.trim();
  const heir = o.dec?.heirName || "them";

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
    <section className="sheet flex flex-col p-6 sm:p-7" aria-labelledby="letter-title">
      <h2 id="letter-title" className="t-serif text-[1.35rem]">
        Your letter
      </h2>
      <p className="mt-1 text-sm text-ink-2">What you&rsquo;d want {heir} to read first. It opens above the recovery guide.</p>
      <label htmlFor="letter" className="sr-only">
        Letter to your heir
      </label>
      <textarea
        id="letter"
        className="field-letter mt-5 min-h-[220px] flex-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        placeholder={`Dear ${o.dec?.heirName || "…"},\n\nIf you're reading this, …`}
        aria-invalid={secret}
        maxLength={8000}
      />
      {secret && (
        <p className="mt-2 text-sm text-claret" role="alert">
          {SECRET_MESSAGE}
        </p>
      )}
      <div className="mt-5 flex items-center gap-4">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || secret || !dirty || !text.trim()}>
          {busy ? "Sealing…" : saved ? "Save changes" : "Save letter"}
        </button>
        <p className="text-sm text-ink-2" role="status">
          {savedAt && !dirty ? "Saved. Encrypted before it left this browser." : dirty ? "Unsaved changes" : saved ? "Kept on Walrus, encrypted." : ""}
        </p>
      </div>
    </section>
  );
}
