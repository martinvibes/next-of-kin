/**
 * The question engine: ask the question that protects the most money first.
 *
 * Candidates: drift items (always first), wallets missing where/how/who,
 * staked assets missing an asset-level how, and assets that are new since the
 * last review. Impact = readiness points gained if that single question were
 * answered, simulated by adding a synthetic fact (or clearing the drift) and
 * recomputing the unrounded score. Because an asset needs where + how + who
 * before it counts, a lone answer often gains 0 at first; sharePct (fair-share
 * attribution of the readiness gap) breaks those ties by money protected.
 * Order: drift first, then impactPct, sharePct, usdAtStake, where→how→who, id.
 *
 * Questions carry only non-sensitive structure; renderQuestion() turns them
 * into words in the browser, where the wallet label can be decrypted.
 */
import { factKey } from "./fold";
import { formatAmount, rawToAmount } from "./format";
import { shortAddress } from "./ids";
import { buildFactLookup, coverageFor, readinessExact, type FactLookup } from "./readiness";
import type { Asset, DriftReport, FactField, NokState, Question, WalletMemory } from "./types";

const FIELDS: readonly FactField[] = ["where", "how", "who"];

/** Natural asking order when everything else ties. */
const KIND_RANK: Record<Question["kind"], number> = { drift: 0, where: 1, how: 2, "how-stake": 3, who: 4, "new-asset": 5 };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface Sim {
  assets: ReadonlyArray<Asset>;
  lookup: FactLookup;
  drifted: ReadonlySet<string>;
  base: number;
}

function gain(sim: Sim, change: { addFact?: [string, FactField]; undrift?: string }): { impactPct: number; usdAtStake: number } {
  const lookup = new Set(sim.lookup);
  if (change.addFact) lookup.add(factKey(change.addFact[0], change.addFact[1]));
  const drifted = new Set(sim.drifted);
  if (change.undrift) drifted.delete(change.undrift);
  const before = readinessExact(sim.assets, sim.lookup, sim.drifted);
  const after = readinessExact(sim.assets, lookup, drifted);
  const beforeCovered = new Set(before.perAsset.filter((c) => c.covered).map((c) => c.assetKey));
  let usdAtStake = 0;
  for (const c of after.perAsset) {
    if (c.covered && !beforeCovered.has(c.assetKey)) {
      usdAtStake += sim.assets.find((a) => a.key === c.assetKey)?.usd ?? 0;
    }
  }
  return { impactPct: Math.max(0, round1(after.exact - sim.base)), usdAtStake: Math.round(usdAtStake * 100) / 100 };
}

/**
 * Fair-share attribution: each uncovered asset's slice of the score is split
 * equally across the question ids that would fill its gaps.
 */
export function shareByQuestion(assets: ReadonlyArray<Asset>, lookup: FactLookup, drifted: ReadonlySet<string>): Map<string, number> {
  const totalUsd = assets.reduce((n, a) => n + (a.usd ?? 0), 0);
  const shares = new Map<string, number>();
  for (const a of assets) {
    const c = coverageFor(a, lookup, drifted.has(a.key));
    if (c.covered) continue;
    const slice = totalUsd > 0 ? ((a.usd ?? 0) / totalUsd) * 100 : (1 / assets.length) * 100;
    const missing: string[] = [];
    if (!c.where) missing.push(`where:${a.walletId}`);
    if (!c.how) missing.push(a.liquid ? `how:${a.walletId}` : `how-stake:${a.key}`);
    if (!c.who) missing.push(`who:${a.walletId}`);
    if (c.drifted) missing.push(`drift:${a.key}`);
    for (const id of missing) shares.set(id, (shares.get(id) ?? 0) + slice / missing.length);
  }
  return shares;
}

function walletContext(w: WalletMemory) {
  return { chain: w.chain, address: w.address, shortAddress: shortAddress(w.address) };
}

export function computeQuestions(assets: ReadonlyArray<Asset>, state: NokState, drift: DriftReport): Question[] {
  const lookup = buildFactLookup(state.facts);
  const drifted = new Set(drift.drifted.map((d) => d.assetKey));
  const base = readinessExact(assets, lookup, drifted).exact;
  const sim: Sim = { assets, lookup, drifted, base };
  const walletsById = new Map(state.wallets.map((w) => [w.walletId, w]));
  const shares = shareByQuestion(assets, lookup, drifted);
  const shareOf = (id: string) => round1(shares.get(id) ?? 0);
  const out: Question[] = [];

  // 1. Drift — memory disagrees with the chain.
  for (const d of drift.drifted) {
    const w = walletsById.get(d.walletId);
    if (!w) continue;
    const asset = assets.find((a) => a.key === d.assetKey);
    const g = gain(sim, { undrift: d.assetKey });
    out.push({
      id: `drift:${d.assetKey}`,
      kind: "drift",
      sharePct: shareOf(`drift:${d.assetKey}`),
      field: null,
      target: d.assetKey,
      walletId: d.walletId,
      assetKey: d.assetKey,
      impactPct: g.impactPct,
      usdAtStake: asset?.usd ?? 0,
      context: { ...walletContext(w), symbol: d.symbol, amount: rawToAmount(d.current, d.decimals), validatorName: asset?.meta.validatorName, drift: d },
    });
  }

  // 2. Wallet-level where / how / who.
  for (const w of state.wallets) {
    const walletAssets = assets.filter((a) => a.walletId === w.walletId);
    const fields: readonly FactField[] = walletAssets.length > 0 ? FIELDS : ["where", "who"];
    for (const field of fields) {
      if (lookup.has(factKey(w.walletId, field))) continue;
      const g = walletAssets.length > 0 ? gain(sim, { addFact: [w.walletId, field] }) : { impactPct: 0, usdAtStake: 0 };
      out.push({
        id: `${field}:${w.walletId}`,
        kind: field,
        sharePct: shareOf(`${field}:${w.walletId}`),
        field,
        target: w.walletId,
        walletId: w.walletId,
        impactPct: g.impactPct,
        usdAtStake: g.usdAtStake,
        context: walletContext(w),
      });
    }
  }

  // 3. Staked assets need their own recovery steps.
  for (const a of assets) {
    if (a.liquid || lookup.has(factKey(a.key, "how"))) continue;
    const w = walletsById.get(a.walletId);
    if (!w) continue;
    const g = gain(sim, { addFact: [a.key, "how"] });
    out.push({
      id: `how-stake:${a.key}`,
      kind: "how-stake",
      sharePct: shareOf(`how-stake:${a.key}`),
      field: "how",
      target: a.key,
      walletId: a.walletId,
      assetKey: a.key,
      impactPct: g.impactPct,
      usdAtStake: g.usdAtStake,
      context: { ...walletContext(w), symbol: a.symbol, amount: a.amount, validatorName: a.meta.validatorName ?? (a.meta.poolId ? shortAddress(a.meta.poolId) : undefined) },
    });
  }

  // 4. New since last review — a confirm sets its baseline.
  for (const key of drift.newAssets) {
    const a = assets.find((x) => x.key === key);
    const w = a ? walletsById.get(a.walletId) : undefined;
    if (!a || !w) continue;
    out.push({
      id: `new-asset:${key}`,
      kind: "new-asset",
      sharePct: 0,
      field: null,
      target: key,
      walletId: a.walletId,
      assetKey: key,
      impactPct: 0,
      usdAtStake: a.usd ?? 0,
      context: { ...walletContext(w), symbol: a.symbol, amount: a.amount, validatorName: a.meta.validatorName },
    });
  }

  return out.sort(
    (x, y) =>
      Number(y.kind === "drift") - Number(x.kind === "drift") ||
      y.impactPct - x.impactPct ||
      y.sharePct - x.sharePct ||
      y.usdAtStake - x.usdAtStake ||
      KIND_RANK[x.kind] - KIND_RANK[y.kind] ||
      (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
}

// ─── Wording ────────────────────────────────────────────────────────────────

export interface RenderedQuestion {
  title: string;
  hint: string;
  placeholder: string;
  prefill?: string;
  cta: string;
}

function walletPhrase(q: Question, label?: string): string {
  return label ? `‘${label}’ (${q.context.shortAddress})` : `your ${q.context.chain === "sui" ? "Sui" : "Ethereum"} wallet ${q.context.shortAddress}`;
}

function amountPhrase(q: Question): string {
  const sym = q.context.symbol ?? "";
  return q.context.amount !== undefined ? formatAmount(q.context.amount, sym) : sym;
}

export function renderQuestion(q: Question, opts: { walletLabel?: string } = {}): RenderedQuestion {
  const wallet = walletPhrase(q, opts.walletLabel);
  switch (q.kind) {
    case "where":
      return {
        title: `Where is the key to ${wallet}?`,
        hint: "Say where the device, app or recovery sheet is kept. Never type the recovery phrase itself.",
        placeholder: "Slush app on my phone; recovery sheet in the fireproof box",
        cta: "Save where it is",
      };
    case "how":
      return {
        title: `How would someone open ${wallet}?`,
        hint: "Describe the steps, and who holds any PIN or password. Don't write the PIN here.",
        placeholder: "Phone PIN is with my lawyer; open Slush → Unlock",
        cta: "Save how to open it",
      };
    case "who":
      return {
        title: `Who should receive what's in ${wallet}?`,
        hint: "Name people, and how to split it if there's more than one.",
        placeholder: "Split equally between my two sisters",
        cta: "Save who receives it",
      };
    case "how-stake": {
      const validator = q.context.validatorName ?? "the validator";
      const amount = amountPhrase(q);
      return {
        title: `How should your heir recover the ${amount} staked with ${validator}?`,
        hint: "Staked SUI can't be sent until it's withdrawn. We drafted the steps from the chain — edit anything that's different.",
        placeholder: "Open the wallet → Staking → withdraw",
        prefill: `This is ${amount} staked with ${validator}. To recover: open the wallet → Staking → withdraw from ${validator}. Funds return at the next epoch (~24h).`,
        cta: "Save recovery steps",
      };
    }
    case "drift": {
      const d = q.context.drift!;
      const before = formatAmount(rawToAmount(d.baseline, d.decimals), d.symbol);
      const now = formatAmount(rawToAmount(d.current, d.decimals), d.symbol);
      const what = d.assetKey.includes(":stake:") ? `staked ${d.symbol}` : d.symbol;
      const title =
        d.reason === "missing"
          ? `The ${before} ${d.assetKey.includes(":stake:") ? "staked " : ""}in ${wallet} is gone. What happened?`
          : d.reason === "dropped"
            ? `Your ${before} ${d.assetKey.includes(":stake:") ? "staked " : ""}in ${wallet} dropped to ${now}. What happened?`
            : `Your ${what} in ${wallet} grew from ${before} to ${now}. Is your note still right?`;
      return {
        title,
        hint: "Your heir's guide treats this asset as uncertain until you confirm what changed.",
        placeholder: "Moved it to my Ledger in March",
        cta: "Confirm",
      };
    }
    case "new-asset":
      return {
        title: `New in ${wallet}: ${amountPhrase(q)}. Is it covered by what you've told us?`,
        hint: "Mark it reviewed so future scans can spot changes to it.",
        placeholder: "",
        cta: "Mark as reviewed",
      };
  }
}
