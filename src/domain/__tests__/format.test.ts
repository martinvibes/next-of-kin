import { describe, expect, it } from "vitest";
import { formatAmount, formatDuration, formatInterval, formatUsd, rawToAmount, relativeTime } from "../format";
import { at } from "./helpers";

describe("format", () => {
  it("converts raw base units", () => {
    expect(rawToAmount("12500000000", 9)).toBe(12.5);
    expect(rawToAmount("1", 9)).toBe(1e-9);
    expect(rawToAmount("0", 9)).toBe(0);
    expect(rawToAmount("5000000", 6)).toBe(5);
    expect(rawToAmount("42", 0)).toBe(42);
    expect(rawToAmount("1000000000000000000", 18)).toBe(1);
  });

  it("formats amounts and USD", () => {
    expect(formatAmount(12.5, "SUI")).toBe("12.5 SUI");
    expect(formatAmount(1234.5678, "SUI")).toBe("1,234.57 SUI");
    expect(formatAmount(0.00012345, "ETH")).toBe("0.000123 ETH");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatUsd(null)).toBe("—");
  });

  it("formats relative times", () => {
    expect(relativeTime(at(0), at(0.2))).toBe("just now");
    expect(relativeTime(at(0), at(1))).toBe("1 minute ago");
    expect(relativeTime(at(0), at(2))).toBe("2 minutes ago");
    expect(relativeTime(at(0), at(180))).toBe("3 hours ago");
    expect(relativeTime(at(0), at(60 * 24 * 2))).toBe("2 days ago");
    expect(relativeTime(at(5), at(0))).toBe("in 5 minutes");
  });

  it("formats durations and intervals", () => {
    expect(formatDuration(41)).toBe("41s");
    expect(formatDuration(161)).toBe("2m 41s");
    expect(formatDuration(3 * 3600 + 720)).toBe("3h 12m");
    expect(formatDuration(29 * 86400 + 5)).toBe("29 days");
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(-4)).toBe("0s");
    expect(formatInterval(180)).toBe("3 minutes");
    expect(formatInterval(30 * 86400)).toBe("30 days");
  });
});
