/**
 * Proves the "memory is the database" store against MemWalMock (no network):
 * write → stored with blob id → fold → clear → rebuild from (mock) Walrus →
 * counts match → idempotent re-write → tampered memory is dropped and counted.
 *
 * Run:  npm run check:store
 */
import { tmpdir } from "node:os";
import path from "node:path";

// Force mock memory + an isolated cache file BEFORE any server module reads env.
process.env.MEMWAL_ACCOUNT_ID = "";
process.env.MEMWAL_PRIVATE_KEY = "";
process.env.MEMWAL_NAMESPACE = "nok-store-check";
process.env.NOK_CACHE_PATH = path.join(tmpdir(), `nok-store-check-${process.pid}.json`);

let failures = 0;
function expect(cond: boolean, label: string, detail = ""): void {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function main(): Promise<void> {
  const store = await import("../src/server/store");
  const memwal = await import("../src/server/memwal");
  const { walletIdOf } = await import("../src/domain/ids");
  const { encodeMemory } = await import("../src/domain/codec");
  type NokMemory = import("../src/domain/types").NokMemory;

  expect(memwal.memoryClient().mode === "mock", "memory mode is mock");
  await store.clear();

  // Shape-valid memories with dummy ciphertext: this checks storage plumbing, not crypto.
  const enc = { enc: { iv: "AAAAAAAAAAAAAAAA", ct: "c3RvcmUtY2hlY2s" } };
  const addr = "0x" + "ab".repeat(32);
  const walletId = walletIdOf("sui", addr);
  const t = (s: number) => new Date(Date.UTC(2026, 10, 9, 12, 0, s)).toISOString();
  const memories: NokMemory[] = [
    { v: 1, id: crypto.randomUUID(), kind: "vault", ts: t(0), salt: "c2FsdHNhbHRzYWx0c2FsdA", iter: 310000, check: enc.enc },
    { v: 1, id: crypto.randomUUID(), kind: "profile", ts: t(1), ownerName: enc, heirName: enc, heirContact: enc, intervalSec: 180, graceSec: 45 },
    { v: 1, id: crypto.randomUUID(), kind: "wallet", ts: t(2), walletId, chain: "sui", address: addr, label: enc },
    { v: 1, id: crypto.randomUUID(), kind: "fact", ts: t(3), target: walletId, field: "where", value: enc, baseline: { [`${walletId}:coin:0x2::sui::SUI`]: "8000000000" } },
    { v: 1, id: crypto.randomUUID(), kind: "checkin", ts: t(4) },
  ];

  const written = [];
  for (const m of memories) written.push(await store.write(m));
  expect(written.every((w) => w.jobId), "every write returns a job id");
  expect(written.every((w) => w.status === "stored" && w.blobId), "mock writes become stored with a blob id", written.map((w) => w.blobId).join(","));

  const pending = await store.refreshPending();
  expect(pending.stillPending === 0, "nothing left pending", JSON.stringify(pending));

  const poll = await store.pollJob(written[2]!.jobId!);
  expect(poll.status === "stored" && poll.memoryId === memories[2]!.id, "pollJob resolves a known job", JSON.stringify(poll));

  const st = await store.getState();
  expect(st.wallets.length === 1 && st.facts.length === 1 && st.vault !== null && st.profile !== null, "fold sees vault, profile, 1 wallet, 1 fact");
  expect(st.lastCheckin === t(4), "fold sees the check-in", String(st.lastCheckin));

  const again = await store.write(memories[0]!);
  expect(again.jobId === written[0]!.jobId, "re-writing the same memory id is idempotent");

  // Simulate a tampered memory sitting in the namespace.
  const good = encodeMemory({ v: 1, id: crypto.randomUUID(), kind: "checkin", ts: t(5) });
  const tampered = good.replace(/nok:v1:(.)/, (_m, c: string) => `nok:v1:${c === "e" ? "f" : "e"}`);
  await memwal.rememberAsync(tampered, "tampered-1");

  await store.clear();
  expect(store.storeInfo().count === 0, "clear() empties the cache");

  const report = await store.rebuildFromWalrus();
  console.log(`      ${report.message}`);
  console.log(`      queries: ${report.queries.join(" | ")}`);
  expect(report.restored === memories.length, "rebuild restores every memory", `${report.restored}/${memories.length}`);
  expect(report.listed === memories.length + 1, "inventory counts the tampered blob too", String(report.listed));
  expect(report.dropped === 1, "tampered memory is dropped and counted", String(report.dropped));
  expect(report.complete, "rebuild reports complete");

  const st2 = await store.getState();
  if (JSON.stringify(st2) !== JSON.stringify(st)) { for (const k of Object.keys(st) as (keyof typeof st)[]) if (JSON.stringify(st[k]) !== JSON.stringify(st2[k])) console.log("      DIFF", k, JSON.stringify(st[k]).slice(0, 200), "=>", JSON.stringify(st2[k]).slice(0, 200)); }
  expect(JSON.stringify(st2) === JSON.stringify(st), "state after rebuild equals state before");

  // Cold start: a fresh process state should reload from the cache file without a rebuild.
  const g = globalThis as { __nokStore?: unknown };
  delete g.__nokStore;
  const all = await store.getAll();
  expect(all.length === memories.length, "cold start reloads from the cache file", String(all.length));

  await store.clear();
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} check(s) failed` : "\nstore check passed");
    process.exit(failures ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(2);
  });
