import { describe, expect, it } from "vitest";
import { anySecret, detectSecret, SECRET_MESSAGE } from "../seedGuard";

const PHRASE12 = "abandon ability able about above absent absorb abstract absurd abuse access accident";
const PHRASE24 =
  "legal winner thank year wave sausage worth useful legal winner thank yellow legal winner thank year wave sausage worth useful legal winner thank yellow";

describe("detectSecret blocks", () => {
  it.each([
    ["a 12-word phrase", PHRASE12, "bip39"],
    ["a 24-word phrase", PHRASE24, "bip39"],
    ["a numbered phrase", "1. abandon 2. ability 3. able 4. about 5. above 6. absent 7. absorb 8. abstract 9. absurd 10. abuse 11. access 12. accident", "bip39"],
    ["a phrase on separate lines", PHRASE12.split(" ").join("\n"), "bip39"],
    ["a capitalised phrase inside a sentence", `My words are: ${PHRASE12.toUpperCase()} — keep safe`, "bip39"],
    ["a phrase with two typos", "abandon ability able about above absentt absorb abstract absurdd abuse access accident", "bip39"],
    ["a Sui private key", "key is suiprivkey1qzg8u3yx7v5u0lq2v4mpa6c9e", "suiprivkey"],
    ["an xprv", "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi", "xprv"],
    ["a tprv", "tprv8ZgxMBicQKsPd9TeAdPADNnSyH9SSUUbTVeFszDE23Ki6TBB5nCefAdHkK8Fm3qMQR6sHwA56zqRmKmxnHk37JkiFzvncDqoKmPWubu7hDF", "xprv"],
    ["a PEM block", "-----BEGIN PRIVATE KEY-----\nMIIEvQ...", "pem"],
    ["a bare 64-hex key", "a".repeat(32) + "0123456789abcdef0123456789abcdef", "hex64"],
    ["a bare 128-hex key", "ab".repeat(64), "hex64"],
  ])("%s", (_name, text, reason) => {
    expect(detectSecret(text)).toEqual({ blocked: true, reason });
  });
});

describe("detectSecret allows", () => {
  it.each([
    ["the brief's example", "Slush app on my phone; recovery sheet in the fireproof box under the stairs, my lawyer Ada Obi has the PIN"],
    ["a how answer", "Phone PIN is with my lawyer; open Slush → Unlock, then go to Staking and withdraw everything to my sister's wallet"],
    ["a who answer", "Split equally between my two sisters, Ngozi and Amaka. If either has passed, everything goes to the other."],
    [
      "a long, wordy letter",
      "If you are reading this, I am sorry I could not tell you in person. Everything you need is in the blue folder in the study, and Mr Okafor at the bank knows what to do. Please look after Mum, and take a holiday with some of it.",
    ],
    ["a list of everyday words", "ledger in the safe, laptop in the office, phone in the kitchen drawer, notebook with the bank"],
    ["a Sui address", "send to 0x" + "ab".repeat(32)],
    ["an EVM address", "0x52908400098527886E0F7030069857D2E4169EE7"],
    ["a Sui object id in text", "pool 0x" + "c3".repeat(32) + " with Mysten"],
    ["only 11 phrase words", PHRASE12.split(" ").slice(0, 11).join(" ")],
    ["the word xprv in prose", "my xprv is not stored anywhere online"],
    ["an empty string", ""],
  ])("%s", (_name, text) => {
    expect(detectSecret(text).blocked).toBe(false);
  });
});

describe("anySecret", () => {
  it("checks every field", () => {
    expect(anySecret("fine", undefined, null, PHRASE12)).toEqual({ blocked: true, reason: "bip39" });
    expect(anySecret("fine", "also fine").blocked).toBe(false);
  });

  it("has a friendly message", () => {
    expect(SECRET_MESSAGE).toMatch(/never stores keys/);
  });
});
