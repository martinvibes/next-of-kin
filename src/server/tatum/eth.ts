import "server-only";
import { getEnv } from "../env";
import { TatumError, tatumFetch } from "./queue";

/** Ethereum Mainnet via Tatum's EVM gateway (JSON-RPC). Kept small: native ETH balance only. */

export const ETH_RPC_URL = "https://ethereum-mainnet.gateway.tatum.io";

let rpcId = 0;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const key = getEnv().tatumApiKey;
  if (!key) throw new TatumError("TATUM_API_KEY is not set", `eth:${method}`, null);
  const res = await tatumFetch(`eth:${method}`, ETH_RPC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (!res.ok) throw new TatumError(`Ethereum ${method}: HTTP ${res.status}`, `eth:${method}`, res.status);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new TatumError(`Ethereum ${method}: ${body.error.message ?? "RPC error"}`, `eth:${method}`, res.status);
  if (body.result === undefined) throw new TatumError(`Ethereum ${method}: empty result`, `eth:${method}`, res.status);
  return body.result;
}

/** Native ETH balance in wei, as a decimal integer string. */
export async function ethBalanceWei(address: string): Promise<string> {
  const hex = await rpc<string>("eth_getBalance", [address, "latest"]);
  return BigInt(hex).toString();
}

export async function ethBlockNumber(): Promise<number> {
  return Number(BigInt(await rpc<string>("eth_blockNumber", [])));
}
