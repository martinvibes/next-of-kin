/** Display helpers shared by server and browser. Pure and locale-stable (en-US). */

/** Convert an integer base-unit string to a JS number in human units. */
export function rawToAmount(raw: string, decimals: number): number {
  const neg = raw.startsWith("-");
  const digits = (neg ? raw.slice(1) : raw).replace(/^0+(?=\d)/, "") || "0";
  if (!/^\d+$/.test(digits)) return 0;
  if (decimals <= 0) return (neg ? -1 : 1) * Number(digits);
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals);
  return (neg ? -1 : 1) * Number(`${whole}.${frac}`);
}

export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  const max = abs === 0 ? 0 : abs < 0.01 ? 6 : abs < 1 ? 4 : abs < 1000 ? 4 : 2;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: max }).format(n);
}

export function formatAmount(n: number, symbol: string): string {
  return `${formatNumber(n)} ${symbol}`;
}

export function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n > 0 && n < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** "just now", "2 minutes ago", "in 3 days". */
export function relativeTime(fromIso: string, nowIso: string): string {
  const diff = Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 1000);
  if (Number.isNaN(diff)) return "—";
  const future = diff < 0;
  const s = Math.abs(diff);
  let body: string;
  if (s < 45) return future ? "in a few seconds" : "just now";
  if (s < 3600) body = plural(Math.max(1, Math.round(s / 60)), "minute");
  else if (s < 86400) body = plural(Math.round(s / 3600), "hour");
  else if (s < 86400 * 60) body = plural(Math.round(s / 86400), "day");
  else body = plural(Math.round(s / (86400 * 30)), "month");
  return future ? `in ${body}` : `${body} ago`;
}

/** "41s", "2m 41s", "3h 12m", "29 days". Negative values clamp to 0. */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return plural(Math.floor(s / 86400), "day");
}

/** "3 minutes", "30 days" — for interval settings. */
export function formatInterval(sec: number): string {
  if (sec < 3600) return plural(Math.round(sec / 60), "minute");
  if (sec < 86400) return plural(Math.round(sec / 3600), "hour");
  return plural(Math.round(sec / 86400), "day");
}
