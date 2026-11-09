"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { StoredMemory } from "@/domain/types";
import { summarize } from "@/domain/codec";

export const WALRUSCAN_BLOB = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

export function shortBlob(blobId: string): string {
  return blobId.length > 14 ? `${blobId.slice(0, 6)}…${blobId.slice(-6)}` : blobId;
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-white/5 hover:text-fg"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
      aria-label={done ? "Copied" : `${label} ${value}`}
      title={done ? "Copied" : label}
    >
      {done ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function BlobLink({ blobId, mock }: { blobId: string; mock?: boolean }) {
  if (mock) return <span className="t-mono text-[0.8rem] text-fg-2" title="Mock store: no real blob">{shortBlob(blobId)}</span>;
  return (
    <a className="t-mono inline-flex items-center gap-1 text-[0.8rem] text-violet hover:underline" href={WALRUSCAN_BLOB(blobId)} target="_blank" rel="noreferrer" title={`Open ${blobId} on Walruscan`}>
      {shortBlob(blobId)}
      <ExternalLink className="size-3 opacity-70" aria-hidden="true" />
    </a>
  );
}

export function StatusDot({ status }: { status: StoredMemory["status"] }) {
  const cls = status === "stored" ? "bg-violet" : status === "failed" ? "bg-rose" : "bg-amber animate-pulse-soft";
  return <span className={`dot ${cls}`} aria-hidden="true" />;
}

/** One memory's journey to Walrus: writing → kept, with its blob. */
export function Receipt({ stored, mock }: { stored: StoredMemory; mock?: boolean }) {
  const { status } = stored;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[0.8125rem] animate-rise" role="status" aria-live="polite">
      <StatusDot status={status} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">
          {status === "pending" && "Writing to Walrus…"}
          {status === "stored" && (mock ? "Kept in the mock store" : "Kept on Walrus Mainnet")}
          {status === "failed" && "Couldn't store this memory"}
        </p>
        <p className="truncate text-fg-3">{summarize(stored.memory)}</p>
      </div>
      <div className="shrink-0">
        {status === "stored" && stored.blobId ? (
          <BlobLink blobId={stored.blobId} mock={mock} />
        ) : status === "failed" ? (
          <span className="text-rose">{stored.error ?? "failed"}</span>
        ) : (
          <span className="text-fg-3">{stored.jobId ? "job accepted" : "sending"}</span>
        )}
      </div>
    </div>
  );
}
