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
  ) {
    super(message);
  }
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
    throw new ApiFailure("Couldn't reach the server. Check your connection and try again.", 0);
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
    throw new ApiFailure(err.error ?? `Request failed (${res.status}).`, res.status, err.code);
  }
  return json as T;
}
