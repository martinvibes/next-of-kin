# Submission answers

Form: https://tatum.io/hackathon/total-recall · Deadline: Tue 10 Nov 2026, 17:00 UTC (aim for 16:00).

| Field | Answer |
|---|---|
| Email | _yours_ |
| Discord | _yours_ |
| LinkedIn | _yours_ |
| Tatum account ID | _from dashboard.tatum.io (account or profile settings)_ |
| Sui address | `0x909f08dd8dcb5db81cbaff0073210270cf2aeaf780f4faa890c07bf48af4c946` |
| MEMWAL_AGENT_ID | `7e6021c57dbc551b200d758ffdb106009f98c3f24c4d04e9572789d53eddff34` |
| Track | Consumer Finance Apps (also for Best Walrus Memory) |
| Repo | https://github.com/martinvibes/next-of-kin |
| Live demo | https://next-of-kin-zeta.vercel.app (proof: https://next-of-kin-zeta.vercel.app/proof) |
| Video | _YouTube / Loom link_ |
| Blog | _dev.to link: paste docs/BLOG.md into a new dev.to post_ |

## Project name

Next of Kin

## One-liner

Keys open wallets. Memory finds them. An agent that learns what your family would need to know about your crypto, and releases it to them only if you go silent.

## Project description

When a crypto holder dies, families usually get keys at best. They don't get the knowledge: which wallets exist, that SUI is staked and has to be withdrawn first, where the hardware wallet is, or who was meant to get what. Existing tools split seed phrases. Nobody solves the knowledge problem.

Next of Kin watches the owner's wallets through Tatum: Sui balances, staked SUI with validator names, USD prices and the latest outgoing transaction. It then asks one question at a time, highest money at stake first. Each answer is encrypted in the browser and stored as a memory on Walrus Memory Mainnet. There is no database: state is a fold over memories, and the `/proof` page rebuilds everything from Walrus on demand.

The agent checks its memory against the chain. When a balance drifts from what an answer described, that asset stops counting and becomes the next question. Heir readiness is a deterministic, on-screen formula, and every change is kept as a snapshot memory, so the chart shows the agent learning over time.

If the owner stops checking in and their wallets go quiet on-chain (verified via Tatum), a dead man's switch releases a printable recovery guide. The heir decrypts it in their browser with a passphrase the owner left them, and the release is written to Walrus as an audit memory. It never stores keys or seed phrases: a guard rejects them in the browser and again on the server.

## How it uses Walrus Memory

Memory is the database (no DB at all), with rebuild-from-Walrus on `/proof`. Payloads are self-verifying and encrypted. Async writes show their blob IDs in the UI. Snapshot memories drive the learning chart, confirm memories record corrections against the chain, and a release memory gives an audit trail. Every memory describes a real Mainnet position.

## How it uses Tatum

All chain data comes through Tatum, server-side, via a throttled and counted queue:

- the Sui GraphQL gateway for balances, coin metadata, StakedSui objects, validator names, the latest outgoing transaction (the switch's proof of life) and the latest checkpoint;
- the Data API for USD rates;
- the Ethereum gateway for an optional ETH balance.
