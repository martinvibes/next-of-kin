import { describe, expect, it } from "vitest";
import { computeSwitch, secondsUntilNextPhase } from "../switch";
import { at } from "./helpers";

const profile = { intervalSec: 180, graceSec: 45 };
const base = { profile, profileCreatedAt: at(0), lastCheckin: null, lastOnchain: null, onchainAvailable: true };

describe("computeSwitch", () => {
  it("is in setup without a profile", () => {
    expect(computeSwitch({ ...base, profile: null, now: at(1) }).phase).toBe("setup");
  });

  it("moves alive → overdue → released from profile creation", () => {
    expect(computeSwitch({ ...base, now: at(2.9) }).phase).toBe("alive");
    expect(computeSwitch({ ...base, now: at(3) }).phase).toBe("overdue");
    expect(computeSwitch({ ...base, now: at(3.7) }).phase).toBe("overdue");
    const released = computeSwitch({ ...base, now: at(3.75) });
    expect(released.phase).toBe("released");
    expect(released.lastAliveSource).toBe("profile");
    expect(released.dueAt).toBe(at(3));
    expect(released.releaseAt).toBe(at(3.75));
  });

  it("a check-in resets the timer", () => {
    const s = computeSwitch({ ...base, lastCheckin: at(2), now: at(4) });
    expect(s).toMatchObject({ phase: "alive", lastAliveSource: "checkin", lastAlive: at(2) });
    expect(secondsUntilNextPhase(s)).toBe(60);
  });

  it("on-chain activity seen via Tatum also resets the timer", () => {
    const s = computeSwitch({ ...base, lastCheckin: at(1), lastOnchain: at(3.5), now: at(5) });
    expect(s).toMatchObject({ phase: "alive", lastAliveSource: "onchain", lastAlive: at(3.5) });
  });

  it("ignores on-chain activity when the lookup is unavailable", () => {
    const s = computeSwitch({ ...base, lastOnchain: at(3.5), onchainAvailable: false, now: at(5) });
    expect(s).toMatchObject({ phase: "released", lastAliveSource: "profile", lastOnchain: null });
  });

  it("prefers the owner's check-in on a tie", () => {
    expect(computeSwitch({ ...base, lastCheckin: at(2), lastOnchain: at(2), now: at(2.5) }).lastAliveSource).toBe("checkin");
  });

  it("counts down through the grace period", () => {
    const s = computeSwitch({ ...base, now: at(3.5) });
    expect(s.phase).toBe("overdue");
    expect(secondsUntilNextPhase(s)).toBe(15);
    expect(secondsUntilNextPhase(computeSwitch({ ...base, now: at(10) }))).toBe(0);
  });
});
