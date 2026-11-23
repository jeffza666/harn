import { describe, expect, it } from "vitest";
import {
  convertUsdCentsToThbSatang,
  formatMinor,
  isIsoDate,
  parseMinor,
  parseRateMilli,
} from "./money";

describe("money", () => {
  it("parses minor units without binary rounding", () => {
    expect(parseMinor("120.50")).toBe(12050);
    expect(parseMinor("120.5")).toBe(12050);
    expect(parseMinor("0")).toBeNull();
    expect(parseMinor("10.555")).toBeNull();
    expect(parseMinor("-1")).toBeNull();
  });

  it("formats from integers", () => {
    expect(formatMinor(12050)).toBe("120.50");
    expect(formatMinor(100000)).toBe("1,000.00");
    expect(formatMinor(1)).toBe("0.01");
  });

  it("parses a positive USD rate with four decimal places", () => {
    expect(parseRateMilli("35.5")).toBe(355000);
    expect(parseRateMilli("0")).toBeNull();
    expect(parseRateMilli("35.123456")).toBeNull();
    expect(isIsoDate("2026-11-23")).toBe(true);
    expect(isIsoDate("2026-02-31")).toBe(false);
  });

  it("rounds half up when converting USD cents to satang", () => {
    expect(convertUsdCentsToThbSatang(1000, 355000)).toBe(35500);
    expect(convertUsdCentsToThbSatang(1, 5000)).toBe(1);
    expect(() => convertUsdCentsToThbSatang(100_000_000, 100_000_000)).toThrow(/overflow/i);
  });
});
