/**
 * M1 live smoke test — run with:  npm run smoke
 *
 * Walrus Memory (Mainnet): health → remember a clearly-labelled smoke memory in
 * a SEPARATE namespace (<namespace>-smoke, never the product namespace) → poll
 * the job → recall it back. Tatum: latest Sui checkpoint, balances + staked SUI
 * + last outgoing tx for each NOK_SUI_ADDRESSES wallet, SUI price, optional ETH
 * balance, and a full scanWallets() pass.
 *
 * Runs under `--conditions=react-server` so src/server modules (which import
 * "server-only") load outside Next.js.
 */
import { existsSync } from "node:fs";
import path from "node:path";

type Status = "PASS" | "FAIL" | "SKIP";
interface Row {
  section: string;
  check: string;
  status: Status;
  detail: string;
}
const rows: Row[] = [];

function loadEnv(): string | null {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    process.loadEnvFile(p);
    return f;
  }
  return null;
}

function short(s: string, n = 72): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

async function check(section: string, name: string, fn: () => Promise<string>): Promise<boolean> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    rows.push({ section, check: name, status: "PASS", detail: `${detail} (${Date.now() - t0} ms)` });
    return true;
  } catch (err) {
    rows.push({ section, check: name, status: "FAIL", detail: short(err instanceof Error ? err.message : String(err), 140) });
    return false;
  }
}

function skip(section: string, name: string, why: string): void {
  rows.push({ section, check: name, status: "SKIP", detail: why });
}

function printTable(): void {
  const w1 = Math.max(...rows.map((r) => r.section.length), 7);
  const w2 = Math.max(...rows.map((r) => r.check.length), 5);
  console.log(`\n${"SECTION".padEnd(w1)}  ${"CHECK".padEnd(w2)}  RESULT  DETAIL`);
  console.log(`${"-".repeat(w1)}  ${"-".repeat(w2)}  ------  ${"-".repeat(40)}`);
  for (const r of rows) console.log(`${r.section.padEnd(w1)}  ${r.check.padEnd(w2)}  ${r.status.padEnd(6)}  ${r.detail}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<number> {
  const envFile = loadEnv();
  console.log(`Next of Kin smoke test · env from ${envFile ?? "(process env only)"} · ${new Date().toISOString()}`);

  const { getEnv } = await import("../src/server/env");
  const env = getEnv();

  const missing: string[] = [];
  if (!env.tatumApiKey) missing.push("TATUM_API_KEY");
  if (!env.memwal) {
    if (!process.env.MEMWAL_ACCOUNT_ID?.trim()) missing.push("MEMWAL_ACCOUNT_ID");
    if (!process.env.MEMWAL_PRIVATE_KEY?.trim()) missing.push("MEMWAL_PRIVATE_KEY");
  }
  if (env.suiAddresses.length === 0) missing.push("NOK_SUI_ADDRESSES (at least one valid 0x… Sui address)");
  if (env.invalidSuiAddresses.length) console.log(`! Ignoring invalid Sui addresses: ${env.invalidSuiAddresses.join(", ")}`);
  if (missing.length) {
    console.log(`\nMissing environment variables (set them in .env.local):\n${missing.map((m) => `  - ${m}`).join("\n")}`);
  }

  // ─── Walrus Memory ──────────────────────────────────────────────────────
  const W = "walrus";
  await check(W, "relayer health (public)", async () => {
    const res = await fetch(`${env.serverUrl}/health`, { signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => ({}))) as { status?: string; version?: string };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `${env.serverUrl} · status=${body.status ?? "?"} version=${body.version ?? "?"}`;
  });

  let publicKey: string | null = null;
  if (!env.memwal) {
    skip(W, "remember → status → recall", "MEMWAL_ACCOUNT_ID / MEMWAL_PRIVATE_KEY not set");
  } else {
    const { MemWal } = await import("@mysten-incubation/memwal");
    const smokeNs = `${env.namespace}-smoke`;
    const client = MemWal.create({ key: env.memwal.privateKey, accountId: env.memwal.accountId, serverUrl: env.serverUrl, namespace: smokeNs });
    await check(W, "delegate public key", async () => {
      publicKey = await client.getPublicKeyHex();
      return publicKey;
    });
    const stamp = new Date().toISOString();
    const text = `Next of Kin smoke test ${stamp} (connectivity check only, not product data)`;
    let jobId = "";
    let ok = await check(W, `remember (ns=${smokeNs})`, async () => {
      const r = await client.rememberAsync(text, { idempotencyKey: `smoke-${stamp}` });
      jobId = r.job_id;
      return `job ${r.job_id} accepted (${r.status})`;
    });
    let blobId = "";
    if (ok) {
      ok = await check(W, "poll job until done", async () => {
        const deadline = Date.now() + 120_000;
        const seen: string[] = [];
        while (Date.now() < deadline) {
          const st = await client.getRememberStatus(jobId);
          if (seen.at(-1) !== st.status) seen.push(st.status);
          if (st.status === "done") {
            blobId = st.blob_id ?? "";
            return `${seen.join(" → ")} · blob ${blobId}`;
          }
          if (st.status === "failed" || st.status === "not_found") throw new Error(`${st.status}: ${st.error ?? ""}`);
          await sleep(2000);
        }
        throw new Error(`timed out after 120 s (states: ${seen.join(" → ")})`);
      });
    }
    if (ok) {
      await check(W, "recall it back", async () => {
        for (let i = 0; i < 5; i++) {
          const r = await client.recall({ query: `Next of Kin smoke test ${stamp}`, limit: 5, namespace: smokeNs });
          const hit = r.results.find((m) => m.text === text || m.blob_id === blobId);
          if (hit) return `found blob ${hit.blob_id} at distance ${hit.distance.toFixed(3)}`;
          await sleep(2000);
        }
        throw new Error("written memory not returned by recall");
      });
      if (blobId) {
        await check(W, "walruscan blob URL", async () => {
          const url = `https://walruscan.com/mainnet/blob/${blobId}`;
          const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
          return `${url} → HTTP ${res.status}`;
        });
      }
    }
    const memwal = await import("../src/server/memwal");
    await check(W, `inventory (ns=${env.namespace})`, async () => {
      const list = await memwal.listAll();
      return `${list.length} memories in the product namespace`;
    });
    await check(W, "owner address", async () => (await memwal.ownerAddress()) ?? "unresolved");
    client.destroy();
  }

  // ─── Tatum ──────────────────────────────────────────────────────────────
  const T = "tatum";
  if (!env.tatumApiKey) {
    skip(T, "all Tatum checks", "TATUM_API_KEY not set");
  } else {
    const sui = await import("../src/server/tatum/sui");
    const prices = await import("../src/server/tatum/prices");
    const eth = await import("../src/server/tatum/eth");
    const scan = await import("../src/server/tatum/scan");
    const queue = await import("../src/server/tatum/queue");
    const { walletIdOf, shortAddress } = await import("../src/domain/ids");

    await check(T, "latest Sui checkpoint", async () => {
      const cp = await sui.latestCheckpoint();
      return `#${cp.sequenceNumber} at ${cp.timestamp}`;
    });
    await check(T, "SUI price (Data API)", async () => {
      const p = await prices.priceUsd("SUI");
      if (!p) throw new Error("no price");
      return `$${p.usd} via ${p.source} at ${p.at}`;
    });
    await check(T, "validator names", async () => {
      const m = await sui.validatorNames();
      if (m.size === 0) throw new Error("empty (UI will fall back to short pool ids)");
      const [first] = m.values();
      return `${m.size} active validators, e.g. "${first}"`;
    });
    for (const address of env.suiAddresses) {
      const tag = shortAddress(address);
      await check(T, `balances ${tag}`, async () => {
        const b = await sui.listAllBalances(address);
        return b.length ? b.map((x) => `${x.coinType.split("::").pop()}=${x.balance}`).join(", ") : "no coins";
      });
      await check(T, `staked SUI ${tag}`, async () => {
        const s = await sui.stakedSui(address);
        return s.length ? s.map((x) => `${x.principalRaw} MIST in pool ${shortAddress(x.poolId)}`).join("; ") : "no StakedSui objects";
      });
      await check(T, `last outgoing tx ${tag}`, async () => (await sui.lastOutgoingTx(address)) ?? "none yet");
    }
    if (env.ethAddress) {
      await check(T, `ETH balance ${shortAddress(env.ethAddress)}`, async () => `${await eth.ethBalanceWei(env.ethAddress!)} wei`);
      await check(T, "ETH price (Data API)", async () => {
        const p = await prices.priceUsd("ETH");
        if (!p) throw new Error("no price");
        return `$${p.usd} via ${p.source}`;
      });
    } else skip(T, "ETH balance", "NOK_ETH_ADDRESS not set (optional)");

    if (env.suiAddresses.length || env.ethAddress) {
      await check(T, "scanWallets() end to end", async () => {
        const wallets = [
          ...env.suiAddresses.map((a) => ({ walletId: walletIdOf("sui", a), chain: "sui" as const, address: a })),
          ...(env.ethAddress ? [{ walletId: walletIdOf("ethereum", env.ethAddress), chain: "ethereum" as const, address: env.ethAddress }] : []),
        ];
        const r = await scan.scanWallets(wallets);
        const errors = r.wallets.filter((w) => w.error).map((w) => `${shortAddress(w.address)}: ${w.error}`);
        if (errors.length) throw new Error(errors.join(" | "));
        const total = r.assets.reduce((s, a) => s + (a.usd ?? 0), 0);
        return `${r.assets.length} assets, $${total.toFixed(2)} total, ${r.tatumCalls} Tatum calls, mode=${r.mode}`;
      });
    }
    const stats = queue.tatumStats();
    console.log(`\nTatum calls this run: ${stats.total} (retries ${stats.retries}, errors ${stats.errors})`);
    console.log(`  by endpoint: ${Object.entries(stats.byLabel).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  printTable();
  if (publicKey) console.log(`\nDelegate public key (believed MEMWAL_AGENT_ID — confirm on the Walrus Memory dashboard):\n  ${publicKey}`);
  const failed = rows.filter((r) => r.status === "FAIL").length;
  const passed = rows.filter((r) => r.status === "PASS").length;
  console.log(`\n${passed} passed · ${failed} failed · ${rows.filter((r) => r.status === "SKIP").length} skipped${missing.length ? ` · missing env: ${missing.join(", ")}` : ""}`);
  return failed > 0 || missing.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("Smoke test crashed:", err);
    process.exit(2);
  });
