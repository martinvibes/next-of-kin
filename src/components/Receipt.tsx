"use client";

import { useState } from "react";
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
      className="rounded px-1.5 py-0.5 text-xs text-ink-2 hover:bg-ink/5 hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
      aria-label={`${label} ${value}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function BlobLink({ blobId, mock }: { blobId: string; mock?: boolean }) {
  if (mock) return <span className="t-mono text-ink-2">{shortBlob(blobId)}</span>;
  return (
    <a className="t-mono link" href={WALRUSCAN_BLOB(blobId)} target="_blank" rel="noreferrer" title={blobId}>
      {shortBlob(blobId)}
    </a>
  );
}

/** A ticket stub showing one memory's journey to Walrus. */
export function Receipt({ stored, mock, onRetry }: { stored: StoredMemory; mock?: boolean; onRetry?: () => void }) {
  const { status } = stored;
  return (
    <div className="stub flex items-stretch text-sm animate-rise" role="status" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-5">
        <StatusDot status={status} />
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {status === "pending" && "Writing to Walrus…"}
            {status === "stored" && (mock ? "Kept in the mock store" : "Kept on Walrus Mainnet")}
            {status === "failed" && "Couldn't store this memory"}
          </p>
          <p className="truncate text-[0.8125rem] text-ink-2">{summarize(stored.memory)}</p>
        </div>
      </div>
      <div className="perforation flex shrink-0 items-center gap-1 py-3 pr-5 pl-4 text-[0.8125rem]">
        {status === "stored" && stored.blobId ? (
          <>
            <span className="text-ink-3">blob</span> <BlobLink blobId={stored.blobId} mock={mock} />
          </>
        ) : status === "failed" ? (
          onRetry ? (
            <button type="button" className="link" onClick={onRetry}>
              Retry
            </button>
          ) : (
            <span className="text-claret">{stored.error ?? "failed"}</span>
          )
        ) : (
          <span className="text-ink-3">{stored.jobId ? "job accepted" : "sending"}</span>
        )}
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: StoredMemory["status"] }) {
  const cls = status === "stored" ? "bg-moss" : status === "failed" ? "bg-claret" : "bg-amber animate-pulse-soft";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} aria-hidden="true" />;
}
