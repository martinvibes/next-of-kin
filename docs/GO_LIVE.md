# Going live: keys, wallets, deploy

This is everything needed to move Next of Kin off mock mode and onto Sui Mainnet, Walrus Memory and Tatum. Do the steps in order. Total time is about 30 minutes, most of it waiting for SUI to arrive.

Never paste a key into a chat, an issue or a commit. Keys go in `.env.local` (ignored by git) and in Vercel's environment variables.

## 1. Two Sui wallets with real funds

The demo only uses real Mainnet positions, so the wallets need real (small) balances.

1. Install Slush (the Sui wallet) from https://slush.app as a browser extension. Create a new wallet and write the recovery phrase on paper. Next of Kin never asks for it.
2. Add a second account in Slush (account menu, then add account). You now have two addresses: **Main** and **Phone**.
3. Buy about 15 SUI on an exchange you already use (Coinbase, Binance, Kraken, OKX, Bybit all list SUI). Withdraw it to the **Main** address, on the **Sui** network.
4. Once it lands, in Slush:
   - **Stake** 2 SUI with any validator (Stake tab). Staked SUI shows up as its own asset.
   - **Swap** 2 SUI to USDC (Swap tab).
   - **Send** 1 to 2 SUI to the **Phone** address.
   - Leave the rest as plain SUI on Main. Keep about 0.1 SUI for gas.
5. Copy both public addresses (they start with `0x`). These go in `NOK_SUI_ADDRESSES`.

Every memory the demo writes then describes one of these real positions.

## 2. Tatum API key (chain data)

1. Go to https://dashboard.tatum.io and sign up (free plan is enough).
2. Open the API keys page. Tatum creates two keys: one for **Mainnet** and one for **Testnet**. Copy the **Mainnet** key.
3. That value is `TATUM_API_KEY`.

The key is only used on the server. It never reaches a browser.

## 3. Walrus Memory account and delegate key

You need `MEMWAL_ACCOUNT_ID` (starts with `0x`) and `MEMWAL_PRIVATE_KEY` (64 hex characters). Use option A. Use option B only if A doesn't work for you.

### Option A: the Walrus Memory dashboard

1. Open https://memory.walrus.xyz and connect the **Main** Slush wallet. Make sure Slush is on **Mainnet**.
2. Create your Walrus Memory account and approve the transaction in Slush (it costs a few cents of SUI in gas).
3. Generate a delegate key, label it "Next of Kin", and approve.
4. Copy the account ID into `MEMWAL_ACCOUNT_ID` and the delegate private key into `MEMWAL_PRIVATE_KEY`. The private key is shown once, so copy it before closing the page.

### Option B: the script in this repo

This signs the same two transactions from your machine.

1. In Slush, open the account settings for **Main** and export its private key (it starts with `suiprivkey1`).
2. In the project folder, run this. It prompts for the key without echoing it, and forgets it afterwards:

   ```bash
   read -s SUI_OWNER_KEY && export SUI_OWNER_KEY && npm run memwal:account; unset SUI_OWNER_KEY
   ```

3. Paste the key, press Enter. The script creates the account, adds a delegate key and writes `MEMWAL_ACCOUNT_ID` and `MEMWAL_PRIVATE_KEY` into `.env.local`. It prints suiscan links for both transactions.

If the wallet already has a Walrus Memory account, add `MEMWAL_ACCOUNT_ID=0x…` before `npm run memwal:account` to skip creation.

The owner key is never written to disk. The app only ever holds the delegate key, which can read and write memories and nothing else.

Storage and gas for memory writes are paid by the public Mainnet relayer, so no WAL is needed.

## 4. Owner secret

This is the password that unlocks writes on your deployment.

```bash
openssl rand -hex 32
```

The output is `OWNER_SECRET`. You type it once in the browser the first time you open `/owner`.

## 5. `.env.local`

Create `.env.local` in the project root (copy `.env.example`) and fill it in:

```bash
TATUM_API_KEY=your-mainnet-key
MEMWAL_ACCOUNT_ID=0x...
MEMWAL_PRIVATE_KEY=64-hex-characters
MEMWAL_NAMESPACE=next-of-kin
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
OWNER_SECRET=output-of-openssl
NOK_SUI_ADDRESSES=0xMAIN...,0xPHONE...
NOK_FIXTURES=0
```

`NOK_FIXTURES` must be `0` (or absent). With it on, chain data is fake and the app says so in a red banner.

## 6. Check it all works

```bash
npm run smoke
```

This writes one clearly labelled test memory to a separate `next-of-kin-smoke` namespace, reads it back, and runs every Tatum call against your wallets. Every row should say PASS. If one fails, the detail column says which key or address is wrong.

Then restart the dev server and open http://localhost:3100. The red "Mock memory" banner should be gone.

## 7. Deploy to Vercel

1. Go to https://vercel.com/new and import `martinvibes/next-of-kin`.
2. Before the first deploy, open **Environment Variables** and add every line from step 5 except `NOK_FIXTURES`.
3. Deploy. Open the URL, go to `/setup`, and run through the vault with the real wallets.
4. Open `/proof` on the deployed site. The memory count, Walrus blob IDs and Tatum calls should all be live.

## Where each key is used

| Variable | Used for | Where it lives |
|---|---|---|
| `TATUM_API_KEY` | Balances, stakes, last transaction, prices | Server only |
| `MEMWAL_ACCOUNT_ID` | Which Walrus Memory account to write to | Server only |
| `MEMWAL_PRIVATE_KEY` | Signing memory reads and writes | Server only |
| `OWNER_SECRET` | Unlocking writes on this deployment | Server, plus your browser session |
| `NOK_SUI_ADDRESSES` | Wallets to watch (you can also add them in the app) | Server |
