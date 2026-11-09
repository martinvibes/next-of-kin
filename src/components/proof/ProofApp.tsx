"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Blocks, Database, ExternalLink, Lock, RefreshCw, RotateCcw, Server } from "lucide-react";
import { relativeTime } from "@/domain/format";
import type { MemoryKind } from "@/domain/types";
import type { ProofResponse, RebuildResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret } from "@/lib/client";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BlobLink, CopyButton, StatusDot } from "@/components/Receipt";
import { KIND } from "@/components/owner/MemoryFeed";

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line px-5 py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
      <dt className="text-[0.8125rem] text-fg-3">{k}</dt>
      <dd className="min-w-0 text-[0.875rem]">{children}</dd>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone: "violet" | "sky" | "mint" | "muted" }) {
  const bar = { violet: "bg-violet", sky: "bg-sky", mint: "bg-mint", muted: "bg-fg-3" }[tone];
  return (
    <div className="card relative overflow-hidden px-5 py-4">
      <span className={`absolute inset-y-4 left-0 w-[3px] rounded-r ${bar}`} aria-hidden="true" />
      <p className="text-[0.75rem] text-fg-3">{label}</p>
      <p className="t-num mt-1.5 text-[1.6rem] leading-none font-semibold tracking-[-0.03em]">{value}</p>
      {sub && <p className="mt-2 truncate text-[0.72rem] text-fg-3">{sub}</p>}
    </div>
  );
}

export function ProofApp() {
  const [p, setP] = useState<ProofResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState<RebuildResponse | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [filter, setFilter] = useState<MemoryKind | "all">("all");

  const load = useCallback(() => {
    api<ProofResponse>("/api/proof")
      .then((r) => {
        setP(r);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof ApiFailure ? e.message : "Couldn't load the proof."));
  }, []);

  useEffect(load, [load]);

  async function doRebuild() {
    setRebuilding(true);
    setErr(null);
    try {
      const r = await api<RebuildResponse>("/api/rebuild", { body: {}, owner: !!getOwnerSecret() });
      setRebuild(r);
      load();
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Rebuild failed.");
    } finally {
      setRebuilding(false);
    }
  }

  const mock = p?.memory.mode === "mock";
  const live = p?.chain.mode === "live";
  const kinds = p ? [...new Set(p.rows.map((r) => r.kind))] : [];
  const rows = p ? [...(filter === "all" ? p.rows : p.rows.filter((r) => r.kind === filter))].sort((a, b) => b.ts.localeCompare(a.ts)) : [];
  const withBlob = p ? p.rows.filter((r) => r.blobId).length : 0;
  const now = new Date().toISOString();

  return (
    <div className="aurora min-h-dvh">
      <ModeBanner status={p ? { memory: p.memory, chain: { mode: p.chain.mode } } : null} />
      <SiteHeader current="proof" />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <section className="flex flex-wrap items-end justify-between gap-6 pt-12 pb-8 animate-rise">
          <div className="max-w-2xl">
            <span className={`pill ${mock ? "pill-rose" : "pill-violet"}`}>
              <span className={`dot ${mock ? "bg-rose" : "bg-violet"}`} />
              {mock ? "Mock memory on this deployment" : "Walrus Mainnet"}
            </span>
            <h1 className="mt-4 text-[clamp(2rem,4.6vw,3rem)] leading-[1.08] font-semibold tracking-[-0.035em]">Check it yourself</h1>
            <p className="mt-3 text-[1.0625rem] text-fg-2">
              Every answer, check-in and snapshot is a memory on Walrus. This server only keeps a cache it can throw away. Every balance is read from Mainnet through Tatum.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw /> Refresh
          </button>
        </section>

        {err && (
          <p className="mb-6 rounded-xl border border-rose/20 bg-rose-wash px-4 py-3 text-[0.875rem] text-rose" role="alert">
            {err}
          </p>
        )}

        {!p ? (
          <div className="space-y-5" role="status" aria-label="Asking Walrus and Tatum">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[92px] rounded-2xl" />
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="skeleton h-72 rounded-2xl" />
              <div className="skeleton h-72 rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
              <Tile tone="violet" label={mock ? "Memories (mock store)" : "Memories on Walrus"} value={p.rows.length} sub={`${withBlob} confirmed with a blob ID`} />
              <Tile
                tone="violet"
                label="Listed by the relayer"
                value={p.listed ?? "—"}
                sub={p.listed !== null ? (p.listed >= p.rows.length ? "Matches the cache" : `${p.rows.length - p.listed} not listed yet`) : (p.listedError ?? "Not available")}
              />
              <Tile tone="sky" label="Tatum calls, this instance" value={p.chain.calls} sub={live ? "Sui Mainnet" : p.chain.mode === "fixtures" ? "Fixture data, not live" : "Chain unavailable"} />
              <Tile
                tone="sky"
                label="Latest Sui checkpoint"
                value={p.chain.checkpoint ? `#${Number(p.chain.checkpoint.sequenceNumber).toLocaleString()}` : "—"}
                sub={p.chain.checkpoint?.timestamp ? relativeTime(p.chain.checkpoint.timestamp, now) : (p.chain.checkpointError ?? "")}
              />
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-2">
              <section className="card overflow-hidden" aria-labelledby="walrus-title">
                <div className="card-head">
                  <h2 id="walrus-title" className="card-title">
                    <Database className="size-4 text-violet" aria-hidden="true" /> Walrus Memory
                  </h2>
                  <span className={`pill ${mock ? "pill-rose" : p.memory.ok ? "pill-violet" : "pill-amber"}`}>{mock ? "Mock, not Walrus" : p.memory.ok ? "Relayer up" : "Relayer unreachable"}</span>
                </div>
                <dl>
                  <Kv k="Relayer">
                    {p.memory.status ?? "—"}
                    {p.memory.version ? <span className="text-fg-3"> {/^\d/.test(p.memory.version) ? "v" : ""}{p.memory.version}</span> : null}
                    {p.memory.error && <span className="mt-1 block text-[0.8125rem] text-rose">{p.memory.error}</span>}
                  </Kv>
                  <Kv k="Namespace">
                    <span className="t-mono text-[0.8125rem] text-fg-2">{p.memory.namespace}</span>
                  </Kv>
                  <Kv k="Agent public key">
                    {p.memory.publicKey ? (
                      <span className="flex items-center gap-1">
                        <span className="t-mono min-w-0 truncate text-[0.75rem] text-fg-2">{p.memory.publicKey}</span>
                        <CopyButton value={p.memory.publicKey} label="Copy public key" />
                      </span>
                    ) : (
                      <span className="text-fg-3">{mock ? "No key in mock mode" : "Unavailable"}</span>
                    )}
                  </Kv>
                </dl>
                <div className="border-t border-line bg-bg-2/60 p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-wash text-violet">
                      <RotateCcw className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">Rebuild from Walrus</p>
                      <p className="mt-0.5 text-[0.8125rem] text-fg-2">Throw away this server&rsquo;s copy and recover every memory from Walrus alone. If this works, Walrus really is the database.</p>
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm mt-4" onClick={doRebuild} disabled={rebuilding}>
                    {rebuilding ? (
                      <>
                        <RefreshCw className="animate-spin" /> Recalling from Walrus…
                      </>
                    ) : (
                      "Rebuild now"
                    )}
                  </button>
                  {rebuild && (
                    <p className={`mt-4 rounded-lg border px-3 py-2.5 text-[0.8125rem] ${rebuild.complete ? "border-mint/20 bg-mint-wash text-mint" : "border-amber/20 bg-amber-wash text-amber"}`} role="status">
                      <strong className="t-num">{rebuild.restored}</strong> restored{rebuild.listed !== null ? ` of ${rebuild.listed} listed` : ""}
                      {rebuild.dropped ? `, ${rebuild.dropped} unreadable dropped` : ""} in {(rebuild.tookMs / 1000).toFixed(1)}s. {rebuild.complete ? "Nothing missing." : rebuild.message}
                    </p>
                  )}
                </div>
              </section>

              <section className="card overflow-hidden" aria-labelledby="tatum-title">
                <div className="card-head">
                  <h2 id="tatum-title" className="card-title">
                    <Blocks className="size-4 text-sky" aria-hidden="true" /> Tatum, Sui Mainnet
                  </h2>
                  <span className={`pill ${live ? "pill-sky" : p.chain.mode === "fixtures" ? "pill-rose" : "pill-amber"}`}>{live ? "Live" : p.chain.mode === "fixtures" ? "Fixtures, not live" : "Unavailable"}</span>
                </div>
                <dl>
                  <Kv k="Latest checkpoint">
                    {p.chain.checkpoint ? (
                      <a
                        className="inline-flex items-center gap-1.5 text-sky hover:underline"
                        href={`https://suiscan.xyz/mainnet/checkpoint/${p.chain.checkpoint.sequenceNumber}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="t-num">#{Number(p.chain.checkpoint.sequenceNumber).toLocaleString()}</span>
                        <ExternalLink className="size-3.5" aria-label="on Suiscan" />
                      </a>
                    ) : (
                      <span className="text-fg-3">{p.chain.checkpointError ?? "—"}</span>
                    )}
                  </Kv>
                  <Kv k="Calls by type">
                    {Object.keys(p.chain.byLabel).length > 0 ? (
                      <ul className="space-y-1.5">
                        {Object.entries(p.chain.byLabel)
                          .sort((a, b) => b[1] - a[1])
                          .map(([k, v]) => {
                            const max = Math.max(...Object.values(p.chain.byLabel));
                            return (
                              <li key={k} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-[0.8125rem]">
                                <span className="truncate text-fg-2">{k}</span>
                                <span className="h-1.5 rounded-full bg-white/[0.05]">
                                  <span className="block h-full rounded-full bg-sky/70" style={{ width: `${(v / max) * 100}%` }} />
                                </span>
                                <span className="t-num text-fg">{v}</span>
                              </li>
                            );
                          })}
                      </ul>
                    ) : (
                      <span className="text-fg-3">No calls yet on this instance.</span>
                    )}
                  </Kv>
                  {p.chain.lastError && (
                    <Kv k="Last error">
                      <span className="text-[0.8125rem] text-amber">{p.chain.lastError}</span>
                    </Kv>
                  )}
                  <Kv k="What it reads">
                    <span className="text-fg-2">Coin balances, staked SUI and validators, the latest outgoing transaction (the switch&rsquo;s proof of life), and USD prices from Tatum&rsquo;s Data API.</span>
                  </Kv>
                  <Kv k="Key handling">
                    <span className="flex items-start gap-2 text-fg-2">
                      <Server className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden="true" />
                      Every Tatum call runs on the server. The API key never reaches the browser.
                    </span>
                  </Kv>
                </dl>
              </section>
            </div>

            <section className="card overflow-hidden" aria-labelledby="ledger-title">
              <div className="card-head flex-wrap gap-y-3">
                <h2 id="ledger-title" className="card-title">
                  <Activity className="size-4 text-violet" aria-hidden="true" /> Every memory
                </h2>
                {kinds.length > 1 && (
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by kind">
                    {(["all", ...kinds] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setFilter(k)}
                        aria-pressed={filter === k}
                        className={`rounded-md px-2 py-1 text-[0.75rem] transition-colors ${filter === k ? "bg-white/[0.08] text-fg" : "text-fg-3 hover:text-fg"}`}
                      >
                        {k === "all" ? "All" : KIND[k].label}
                        <span className="t-num ml-1.5 text-fg-3">{k === "all" ? p.rows.length : p.rows.filter((r) => r.kind === k).length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-[0.75rem] text-fg-3">
                <Lock className="size-3 shrink-0" aria-hidden="true" />
                Summaries only. Wallet labels, answers, names and the letter are encrypted in the owner&rsquo;s browser and never appear here.
              </p>
              {rows.length === 0 ? (
                <p className="px-5 py-12 text-center text-[0.875rem] text-fg-3">No memories yet. They appear here as soon as the owner sets up a vault.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table min-w-[680px]">
                    <caption className="sr-only">Memories stored on Walrus</caption>
                    <thead>
                      <tr>
                        <th>Kind</th>
                        <th>Summary</th>
                        <th>Written</th>
                        <th>Walrus blob</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const k = KIND[r.kind];
                        return (
                          <tr key={r.id}>
                            <td className="whitespace-nowrap">
                              <span className="flex items-center gap-2.5">
                                <span className={`grid size-7 place-items-center rounded-lg ${k.tone}`} aria-hidden="true">
                                  <k.icon className="size-3.5" />
                                </span>
                                {k.label}
                              </span>
                            </td>
                            <td className="text-fg-2">{r.summary.replace(/^[a-z]+ · /, "")}</td>
                            <td className="whitespace-nowrap text-fg-3">{relativeTime(r.ts, now)}</td>
                            <td className="whitespace-nowrap">
                              {r.blobId ? (
                                <BlobLink blobId={r.blobId} mock={mock} />
                              ) : (
                                <span className="flex items-center gap-2 text-[0.8125rem]">
                                  <StatusDot status={r.status} />
                                  <span className={r.status === "failed" ? "text-rose" : "text-fg-3"}>{r.status === "failed" ? "failed" : "writing…"}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
