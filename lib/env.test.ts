import { describe, expect, it } from "vitest";
import { DEFAULT_GEMINI_MODEL, isSupportedFlashModel } from "./env";
import { createRateLimiter } from "./rate-limit";

describe("model guard", () => {
  it("accepts the default Flash model and rejects image or retired ids", () => {
    expect(isSupportedFlashModel(DEFAULT_GEMINI_MODEL)).toBe(true);
    expect(isSupportedFlashModel("gemini-flash-latest")).toBe(true);
    expect(isSupportedFlashModel("gemini-2.0-flash")).toBe(false);
    expect(isSupportedFlashModel("gemini-1.5-flash")).toBe(false);
    expect(isSupportedFlashModel("gemini-3-flash-preview")).toBe(false);
    expect(isSupportedFlashModel("gemini-3.8-flash-image")).toBe(false);
    expect(isSupportedFlashModel("imagen-4.0-generate-001")).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows a burst and then opens the window again", () => {
    const limiter = createRateLimiter(2, 1_000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 10)).toBe(true);
    expect(limiter.allow("a", 20)).toBe(false);
    expect(limiter.allow("b", 20)).toBe(true);
    expect(limiter.allow("a", 1_020)).toBe(true);
  });
});
