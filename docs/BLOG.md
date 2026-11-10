---
title: "Next of Kin: an agent that remembers what your family needs to open your crypto"
published: false
tags: walrus, sui, tatum, hackathon
---

In Nigeria every bank form asks for your next of kin. None of them ask what that person will need to know.

Crypto makes this worse. When a holder dies, the family might find a seed phrase in a drawer, if they're lucky. What they usually don't have is the knowledge around it: which wallets exist, on which chains, that some SUI is staked and has to be withdrawn before it can move, which laptop the wallet extension lives on, and who was meant to get what.

Tools like Shardium, Deadhand and Sarcophagus handle the key problem with seed splitting and dead man's switches. I built Next of Kin for the knowledge problem. It's my entry to Total Recall, the Tatum × Walrus Memory hackathon.

- Live: https://next-of-kin-zeta.vercel.app
- Proof that it's on Mainnet: https://next-of-kin-zeta.vercel.app/proof
- Code: https://github.com/martinvibes/next-of-kin

## What it does

1. **It reads your wallets through Tatum.** Coin balances, staked SUI with validator names, USD prices, and the time of your last outgoing transaction.
2. **It asks one question at a time.** "Where is the key to your Main wallet?" "How would someone open it?" "Who should receive what's in it?" The question with the most money behind it comes first.
3. **It keeps each answer as a memory on Walrus.** The answer is encrypted in your browser before it leaves. You watch the receipt go from *writing* to *kept on Walrus* with a blob ID.
4. **It checks its memory against the chain.** If a balance moves well away from what an answer described, that asset stops counting and becomes the next question.
5. **If you go silent, it hands over.** When you stop checking in and your wallets stop sending transactions (checked through Tatum), your heir can open a letter and a step-by-step recovery guide with the passphrase you left them.

It never stores keys or seed phrases. A guard rejects them as you type, and again on the server.

## Memory is the database

There is no database in this app. Every vault, profile, wallet, answer, check-in, letter, readiness snapshot and release is one text in Walrus Memory. The app's state is a fold over those memories, where the latest one for each key wins.

Each memory looks like this:

```
Next of Kin · fact · where · sui wallet 0x909f…c946 ⟦nok:v1:<base64url JSON>.<sha256 check>⟧
```

The human-readable prefix makes the relayer inventory legible. The payload inside the brackets is validated against a strict zod schema and a checksum, so tampered or foreign texts are dropped and counted rather than trusted. The sensitive fields inside (answers, wallet labels, names, the heir's contact and the letter) are AES-GCM ciphertext. The key comes from the owner's passphrase through PBKDF2 with 310,000 iterations, and it never leaves the browser.

The `/proof` page has a **Rebuild now** button. The server throws its cache away, recalls every memory from Walrus, decodes and verifies each one, rebuilds state from nothing, and compares the count with the relayer's own inventory. If that number matches, Walrus really is the source of truth.

Writes use `rememberAsync`. The API returns a job ID straight away and the UI polls until the blob ID arrives. The memory's own ID is the idempotency key, so a retry never writes twice.

## Learning you can see

"Agent memory" is easy to claim and hard to show. Next of Kin computes a heir readiness score with a fixed formula, no LLM:

- An asset is **covered** when the heir would know **where** the key is, **how** to open it and **who** receives it, and the balance hasn't drifted since those answers.
- `readiness = covered USD ÷ total USD × 100`

Whenever the score moves, the server writes a `snapshot` memory. The readiness chart on the dashboard is drawn only from those snapshots. In my own run it went 0% → 88% → 100% as I answered six questions about two real wallets.

## How Tatum fits in

Every chain read goes through Tatum on the server, through one throttled queue that counts each call (the count is on `/proof`):

| What | Tatum endpoint |
|---|---|
| Coin balances | Sui GraphQL gateway, `balances` |
| Coin symbols and decimals | Sui GraphQL, coin metadata |
| Staked SUI | Sui GraphQL, owned `StakedSui` objects |
| Validator names | Sui GraphQL, the active validator set |
| Last outgoing transaction | Sui GraphQL, `transactions` filtered by sender |
| Latest checkpoint | Sui GraphQL, `checkpoint` |
| USD prices | Data API, `/v4/data/rate/symbol` |

The last outgoing transaction matters most. The dead man's switch uses `max(last check-in, last outgoing transaction, setup)` as the last sign of life. If you're still moving funds, you're alive, even if you forgot to press the button. Before releasing anything, the heir view re-reads the chain. If Tatum can't be reached, the letter stays sealed.

One thing I learned the hard way: the gateway keeps a recent window of history, not all of it. A query for "this address's last transaction" with no lower bound failed on a busy wallet. Scoping the filter to a window of recent checkpoints (`afterCheckpoint`) fixed it.

## A bug Walrus helped me find

On Vercel each serverless instance keeps its own cache, and a write shows up in the relayer's inventory only once it's indexed, about fifteen seconds later. During my real run, I answered "where is the key to Main" and then "how would someone open it". The next scan landed on a different instance that hadn't seen the first answer yet, so it asked "where" again.

The fix was small. The browser already holds the exact codec text of everything it wrote in this session, so it sends those back with each owner request. Whichever instance answers checks that each text decodes to the claimed ID and contains no secret, and folds it in as pending until its blob ID arrives. Because the memories are self-verifying, a client can't slip in something the codec wouldn't accept.

## What it doesn't do (yet)

- The relayer sees the non-sensitive summaries and public wallet addresses. Only the content is encrypted.
- The release is enforced by this server, so an operator could withhold it. The next step is Seal encryption with a Move policy, so the release happens on-chain once the owner goes silent.
- One owner and one heir per deployment.
- The 3-minute check-in interval exists only for the demo and is labelled that way. Real intervals are 30, 90 or 180 days.

Every memory in this demo describes a real Mainnet position in wallets I funded myself. You can check each blob ID on Walruscan from the proof page.
