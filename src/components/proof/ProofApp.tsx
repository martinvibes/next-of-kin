"use client";

import { useCallback, useEffect, useState } from "react";
import { relativeTime } from "@/domain/format";
import type { ProofResponse, RebuildResponse } from "@/lib/api-types";
import { api, ApiFailure, getOwnerSecret } from "@/lib/client";
import { ModeBanner } from "@/components/ModeBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BlobLink, CopyButton } from "@/components/Receipt";

const KIND_LABEL: Record<string, string> = {
  vault: "Vault",
  profile: "Profile",
  wallet: "Wallet",
  fact: "Answer",
  confirm: "Confirmation",
  letter: "Letter",
  checkin: "Check-in",
  snapshot: "Snapshot",
  release: "Release",
};

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-moss-wash text-moss" : "bg-claret-wash text-claret"}`}>{children}</span>;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-rule-soft py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-2">{k}</dt>
      <dd className="min-w-0 text-[0.9375rem]">{children}</dd>
    </div>
  );
}

export function ProofApp() {
  const [p, setP] = useState<ProofResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState<RebuildResponse | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [filter, setFilter] = useState<string>("all");

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
  const rows = p ? (filter === "all" ? p.rows : p.rows.filter((r) => r.kind === filter)) : [];
  const kinds = p ? [...new Set(p.rows.map((r) => r.kind))] : [];
  const now = new Date().toISOString();

  return (
    <>
      <ModeBanner status={p ? { memory: p.memory, chain: { mode: p.chain.mode } } : null} />
      <SiteHeader current="proof" />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <section className="max-w-3xl pt-6">
          <h1 className="t-display text-[clamp(2.4rem,5.5vw,3.8rem)] leading-[1.05] text-balance">Don&rsquo;t take our word for it.</h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] text-ink-2">
            Every answer, check-in and snapshot is a memory on Walrus. This server keeps only a cache it can throw away. Every balance is read from Mainnet through Tatum. Here is the evidence, live.
          </p>
        </section>

        {err && (
          <p className="mt-8 rounded-lg bg-claret-wash px-4 py-3 text-sm text-claret" role="alert">
            {err}
          </p>
        )}

        {!p ? (
          <p className="mt-12 text-ink-2 animate-pulse-soft" role="status">
            Asking Walrus and Tatum…
          </p>
        ) : (
          <>
            <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
              <section className="sheet p-6 sm:p-8" aria-labelledby="walrus-title">
                <div className="flex items-start justify-between gap-4">
                  <h2 id="walrus-title" className="t-serif text-[1.4rem]">
                    Walrus Memory
                  </h2>
                  <Badge ok={!mock && p.memory.ok}>{mock ? "Mock, not Walrus" : p.memory.ok ? "Mainnet relayer up" : "Relayer unreachable"}</Badge>
                </div>
                <dl className="mt-5">
                  <Row k="Relayer">
                    {p.memory.status}
                    {p.memory.version ? ` · ${/^\d/.test(p.memory.version) ? "v" : ""}${p.memory.version}` : ""}
                    {p.memory.error && <span className="block text-sm text-claret">{p.memory.error}</span>}
                  </Row>
                  <Row k="Namespace">
                    <span className="t-mono text-sm">{p.memory.namespace}</span>
                  </Row>
                  <Row k="Agent public key">
                    {p.memory.publicKey ? (
                      <span className="flex items-center gap-2">
                        <span className="t-mono text-[0.78rem] break-all">{p.memory.publicKey}</span>
                        <CopyButton value={p.memory.publicKey} />
                      </span>
                    ) : (
                      <span className="text-ink-3">{mock ? "No key in mock mode" : "Unavailable"}</span>
                    )}
                  </Row>
                  <Row k="Memories">
                    <span className="t-num">{p.rows.length}</span> in this server&rsquo;s cache
                    {p.listed !== null ? (
                      <>
                        {" · "}
                        <span className="t-num">{p.listed}</span> listed by the relayer
                      </>
                    ) : (
                      p.listedError && <span className="block text-sm text-ink-3">Inventory: {p.listedError}</span>
                    )}
                  </Row>
                </dl>
                <div className="mt-6 rounded-xl bg-sheet-2 p-5">
                  <p className="font-semibold">Rebuild from Walrus</p>
                  <p className="mt-1 text-sm text-ink-2">Throw away this server&rsquo;s copy and recover every memory from Walrus alone. If this works, Walrus really is the database.</p>
                  <button type="button" className="btn btn-primary btn-sm mt-4" onClick={doRebuild} disabled={rebuilding}>
                    {rebuilding ? "Recalling from Walrus…" : "Rebuild now"}
                  </button>
                  {rebuild && (
                    <p className="mt-3 text-sm" role="status">
                      <strong className="t-num">{rebuild.restored}</strong> memories restored{rebuild.listed !== null ? ` of ${rebuild.listed} listed` : ""}
                      {rebuild.dropped ? `, ${rebuild.dropped} unreadable dropped` : ""} in {(rebuild.tookMs / 1000).toFixed(1)}s. {rebuild.complete ? "Nothing missing." : rebuild.message}
                    </p>
                  )}
                </div>
              </section>

              <section className="sheet p-6 sm:p-8" aria-labelledby="tatum-title">
                <div className="flex items-start justify-between gap-4">
                  <h2 id="tatum-title" className="t-serif text-[1.4rem]">
                    Tatum, Sui Mainnet
                  </h2>
                  <Badge ok={p.chain.mode === "live"}>{p.chain.mode === "live" ? "Live" : p.chain.mode === "fixtures" ? "Fixtures, not live" : "Unavailable"}</Badge>
                </div>
                <dl className="mt-5">
                  <Row k="Latest checkpoint">
                    {p.chain.checkpoint ? (
                      <>
                        <span className="t-num font-semibold">#{Number(p.chain.checkpoint.sequenceNumber).toLocaleString()}</span>
                        {p.chain.checkpoint.timestamp && <span className="text-ink-2"> · {relativeTime(p.chain.checkpoint.timestamp, now)}</span>}
                        <a className="link ml-2 text-sm" href={`https://suiscan.xyz/mainnet/checkpoint/${p.chain.checkpoint.sequenceNumber}`} target="_blank" rel="noreferrer">
                          Suiscan
                        </a>
                      </>
                    ) : (
                      <span className="text-ink-3">{p.chain.checkpointError ?? "—"}</span>
                    )}
                  </Row>
                  <Row k="Calls this instance">
                    <span className="t-num font-semibold">{p.chain.calls}</span>
                    {Object.keys(p.chain.byLabel).length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(p.chain.byLabel)
                          .sort((a, b) => b[1] - a[1])
                          .map(([k, v]) => (
                            <span key={k} className="rounded-full bg-sheet-2 px-2 py-0.5 text-xs text-ink-2">
                              {k} <span className="t-num text-ink">{v}</span>
                            </span>
                          ))}
                      </span>
                    )}
                  </Row>
                  {p.chain.lastError && (
                    <Row k="Last error">
                      <span className="text-sm text-amber">{p.chain.lastError}</span>
                    </Row>
                  )}
                  <Row k="What it reads">
                    <span className="text-ink-2">Coin balances, staked SUI and validators, the latest outgoing transaction (the switch&rsquo;s proof of life), and USD prices from Tatum&rsquo;s Data API.</span>
                  </Row>
                </dl>
              </section>
            </div>

            <section className="mt-16" aria-labelledby="ledger-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="ledger-title" className="t-display text-[clamp(1.8rem,3.4vw,2.4rem)] leading-tight">
                    Every memory
                  </h2>
                  <p className="mt-2 max-w-2xl text-ink-2">Summaries only. Wallet labels, answers, names and the letter are encrypted in the owner&rsquo;s browser and never appear here.</p>
                </div>
                {kinds.length > 1 && (
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    Show
                    <select className="field !w-auto !py-1.5 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">All kinds</option>
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k] ?? k}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="sheet mt-6 p-8 text-center text-ink-2">No memories yet. They appear here as soon as the owner sets up the vault.</p>
              ) : (
                <div className="sheet mt-6 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[0.9375rem]">
                    <caption className="sr-only">Memories stored on Walrus</caption>
                    <thead className="text-[0.8125rem] text-ink-2">
                      <tr className="border-b border-rule-soft">
                        <th className="px-5 py-3 font-medium sm:px-6">Kind</th>
                        <th className="px-3 py-3 font-medium">Summary</th>
                        <th className="px-3 py-3 font-medium">Written</th>
                        <th className="px-5 py-3 font-medium sm:px-6">Walrus blob</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-rule-soft last:border-0">
                          <td className="px-5 py-3 whitespace-nowrap sm:px-6">{KIND_LABEL[r.kind] ?? r.kind}</td>
                          <td className="px-3 py-3 text-ink-2">{r.summary.replace(/^[a-z]+ · /, "")}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-ink-2">{relativeTime(r.ts, now)}</td>
                          <td className="px-5 py-3 whitespace-nowrap sm:px-6">
                            {r.blobId ? (
                              <BlobLink blobId={r.blobId} mock={mock} />
                            ) : r.status === "failed" ? (
                              <span className="text-sm text-claret">failed</span>
                            ) : (
                              <span className="text-sm text-ink-3 animate-pulse-soft">writing…</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
