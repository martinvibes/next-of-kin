# Demo video script (2:30)

Record at 1440×900, browser zoom 100%. Use the live deployment with the real test wallets. Set the vault to the **3-minute demo interval** shortly before recording the switch segment, or record that part last.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Landing page, hero | "When crypto holders die, families get keys at best. They don't get knowledge: which wallets, which chains, what's staked, where the hardware wallet is." |
| 0:15 | `/heir` | "This is what the heir sees today. Sealed. Only that the owner was seen recently, nothing else." |
| 0:25 | `/owner`, seal at its starting score | "This is the owner's side. Next of Kin read these wallets through Tatum: liquid SUI, USDC, and SUI staked with a validator. Heir readiness is low, and the formula is right here." Open _How is this calculated?_ for a second. |
| 0:40 | Question card | "It asks one question at a time, the one that protects the most money first. Where is the key to this wallet?" Type the answer. "It's encrypted in my browser before it leaves." Press ⌘↵. |
| 0:55 | Receipt goes from _Writing to Walrus_ to _Kept on Walrus Mainnet_ | "That's a Walrus Mainnet memory, with its blob ID." Seal inks forward, +N points chip. |
| 1:05 | Answer the stake question | "Staked SUI can't just be sent, it has to be withdrawn first. So it asks about that one separately." |
| 1:15 | Drift: _Needs a check_ card after moving funds A → B | "I moved funds earlier. The next Tatum scan caught that the balance no longer matches what I described. That asset stops counting until I confirm." Click _I moved it_. |
| 1:30 | Readiness chart, hover a point | "Every point here is a snapshot memory on Walrus. This is the agent learning: from N% to M%, one real answer at a time." |
| 1:45 | `/proof` → _Rebuild now_ | "The server can forget everything. Walrus doesn't. All memories restored, counts match the relayer." Point at the Tatum call counter and checkpoint. |
| 2:00 | `/heir` after the demo interval: _Released_ | "I stopped checking in and the wallets went quiet on-chain, verified through Tatum. The letter is released, and that release is itself a memory." Enter the passphrase. |
| 2:10 | Letter + recovery guide | "Decrypted in the heir's browser. The letter, then each wallet: where, how, who, live balances, and the exact steps. Printable." Scroll to the staked SUI steps. |
| 2:25 | Seal | "Next of Kin. Keys open wallets. Memory finds them." |

## Before recording

- [ ] `/proof` shows **Mainnet relayer up** and **Live** (no red banner anywhere).
- [ ] At least 10 Mainnet memories exist, with blob IDs.
- [ ] One drift was triggered by a real transfer and is waiting to be resolved (or resolve it on camera).
- [ ] Do a check-in right before the owner segment, so the switch shows a full countdown.
- [ ] Set the browser to light mode and hide bookmarks.
