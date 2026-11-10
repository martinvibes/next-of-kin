/**
 * Create a Walrus Memory (MemWal) account on Sui Mainnet and a delegate key for this app,
 * then write MEMWAL_ACCOUNT_ID and MEMWAL_PRIVATE_KEY into .env.local.
 *
 * Backup for when the dashboard at memory.walrus.xyz isn't an option.
 *
 *   SUI_OWNER_KEY=suiprivkey1... npm run memwal:account
 *
 * SUI_OWNER_KEY is the private key of a Sui wallet holding a little SUI for gas (about 0.05 SUI).
 * It is only used to sign two transactions on this machine. It is never written to disk,
 * never sent anywhere except as signed transactions, and never stored by the app.
 * The app itself only ever gets the delegate key, which can read and write memories and nothing else.
 *
 * If that wallet already owns a MemWal account, pass its ID to skip creation:
 *   SUI_OWNER_KEY=suiprivkey1... MEMWAL_ACCOUNT_ID=0x... npm run memwal:account
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { addDelegateKey, createAccount, generateDelegateKey } from "@mysten-incubation/memwal/account";

// Mainnet contract, from https://docs.wal.app/walrus-memory/contract/overview
const PACKAGE_ID = "0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5";
const REGISTRY_ID = "0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f";

function setEnv(file: string, vars: Record<string, string>) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(vars)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text}${text.endsWith("\n") || text === "" ? "" : "\n"}${line}\n`;
  }
  writeFileSync(file, text, { mode: 0o600 });
}

async function main() {
  const owner = process.env.SUI_OWNER_KEY?.trim();
  if (!owner?.startsWith("suiprivkey1")) {
    console.error("Set SUI_OWNER_KEY to a Sui private key (it starts with suiprivkey1). In Slush: Settings → your account → Export private key.");
    process.exit(1);
  }
  const base = { packageId: PACKAGE_ID, registryId: REGISTRY_ID, suiPrivateKey: owner, suiNetwork: "mainnet" as const };

  let accountId = process.env.MEMWAL_ACCOUNT_ID?.trim();
  if (!accountId) {
    console.log("Creating a MemWal account on Sui Mainnet…");
    try {
      const acc = await createAccount(base);
      accountId = acc.accountId;
      console.log(`  account ${accountId}\n  owner   ${acc.owner}\n  tx      https://suiscan.xyz/mainnet/tx/${acc.digest}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Couldn't create the account: ${msg}`);
      console.error("If this wallet already has a MemWal account, rerun with MEMWAL_ACCOUNT_ID=0x… (find it on memory.walrus.xyz or in the wallet's objects as MemWalAccount).");
      console.error("If it says the balance is too low, send about 0.05 SUI to the wallet first.");
      process.exit(1);
    }
  }

  console.log("Generating a delegate key for Next of Kin…");
  const delegate = await generateDelegateKey();
  const added = await addDelegateKey({ ...base, accountId, publicKey: delegate.publicKey, label: "Next of Kin server" });
  console.log(`  delegate ${added.publicKey ?? ""}\n  tx       https://suiscan.xyz/mainnet/tx/${added.digest}`);

  const file = path.resolve(process.cwd(), ".env.local");
  setEnv(file, { MEMWAL_ACCOUNT_ID: accountId, MEMWAL_PRIVATE_KEY: delegate.privateKey });
  console.log(`\nWrote MEMWAL_ACCOUNT_ID and MEMWAL_PRIVATE_KEY to ${file}.`);
  console.log("Copy the same two values into Vercel → Project → Settings → Environment Variables.");
  console.log("Next: npm run smoke");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
