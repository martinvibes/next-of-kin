"use client";

import type { ApiError } from "./api-types";

const OWNER_KEY = "nok.owner-secret";

export function getOwnerSecret(): string | null {
  try {
    return sessionStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setOwnerSecret(secret: string | null) {
  try {
    if (secret) sessionStorage.setItem(OWNER_KEY, secret);
    else sessionStorage.removeItem(OWNER_KEY);
  } catch {
    /* private mode: the secret lives only for this page */
  }
}

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: ApiError["code"],
    /** the server's own wording, when it was replaced with a plainer message */
    public raw?: string,
  ) {
    super(message);
  }
}

const NETWORK = "Couldn't reach the server. Check your connection and try again.";

/**
 * Turn a failed response into "what happened + what to do".
 * Specific server messages (refusals, the seed guard, validation) are kept as written;
 * generic or technical ones are replaced.
 */
export function explainFailure(status: number, code: ApiError["code"] | undefined, server: string | undefined): string {
  const said = server?.trim() || undefined;
  if (code === "secret-detected" && said) return said;
  if (status === 0) return NETWORK;
  if (status === 401) return "The owner key wasn't accepted, so nothing changed. Lock the vault and unlock it again with this deployment's OWNER_SECRET.";
  if (status === 403) return "That isn't allowed on this deployment.";
  if (status === 404) return said ?? "That wasn't found on this server. Reload the page and try again.";
  if (status === 409) return said ?? "That conflicts with what's already saved. Reload the page to see the latest, then try again.";
  if (status === 413) return "That's too large to save. Shorten it and try again.";
  if (status === 429) return said ?? "Too many requests in a short time. Wait a minute, then try again.";
  if (status === 503 && !code && said) return said; // e.g. OWNER_SECRET not configured: already specific
  if (status === 502 || status === 503 || status === 504) {
    const who = said && /tatum/i.test(said) ? "Tatum" : said && /walrus|memwal|relayer|memory/i.test(said) ? "Walrus Memory" : "Walrus Memory or Tatum";
    return `${who} didn't answer just now. Nothing was lost. Try again in a minute.`;
  }
  if (status >= 500) return "The server hit an unexpected error. Try again in a moment.";
  if (status === 400) return said ?? "The server couldn't read that request. Reload the page and try again.";
  return said ?? `The request didn't go through (${status}). Try again in a moment.`;
}

/** The message to show for any thrown value. */
export function errorText(e: unknown, fallback: string): string {
  if (e instanceof ApiFailure) return e.message;
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Worth offering "Try again": the network, rate limits and upstream hiccups. */
export function isRetryable(e: unknown): boolean {
  if (!(e instanceof ApiFailure)) return true;
  return e.status === 0 || e.status === 429 || (e.status >= 500 && !(e.status === 503 && !e.code));
}

export async function api<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown; owner?: boolean; secret?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const secret = init.secret ?? (init.owner ? getOwnerSecret() : null);
  if (secret) headers["x-owner-secret"] = secret;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiFailure(NETWORK, 0);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = (json ?? {}) as Partial<ApiError>;
    const message = explainFailure(res.status, err.code, err.error);
    throw new ApiFailure(message, res.status, err.code, err.error && err.error !== message ? err.error : undefined);
  }
  return json as T;
}
