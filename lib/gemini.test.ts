import { describe, expect, it, vi } from "vitest";
import { interpretProviderResponse, requestExtraction } from "./gemini";

const draft = {
  merchant: "Cafe",
  currency: "THB",
  items: [
    {
      name: "tea",
      quantity: 1,
      unitPrice: "40.00",
      lineTotal: "40.00",
      priceBasis: "unit",
      unresolved: [],
    },
  ],
  vat: { treatment: "none", amount: null },
  service: { treatment: "none", amount: null },
  printedSubtotal: "40.00",
  printedTotal: "40.00",
  warnings: [],
};

function interaction(payload: unknown, status = "completed") {
  return JSON.stringify({
    status,
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(payload) }] }],
  });
}

describe("interpretProviderResponse", () => {
  it("reads a structured interaction", () => {
    const result = interpretProviderResponse(200, interaction(draft));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.items[0]?.name).toBe("tea");
  });

  it("reports malformed, quota, and refusal without dropping the status", () => {
    expect(interpretProviderResponse(200, interaction({ items: [] })).ok).toBe(false);
    expect(interpretProviderResponse(200, "{")).toEqual({ ok: false, code: "malformed" });
    expect(interpretProviderResponse(429, "{}")).toEqual({ ok: false, code: "quota" });
    expect(interpretProviderResponse(200, interaction(draft, "failed"))).toEqual({ ok: false, code: "provider" });
    const blocked = interpretProviderResponse(
      200,
      JSON.stringify({ status: "failed", error: { message: "safety block" } }),
    );
    expect(blocked).toEqual({ ok: false, code: "refused" });
  });
});

describe("requestExtraction", () => {
  it("retries a 503 once and keeps the key out of the body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(interaction(draft), { status: 200 }));
    const result = await requestExtraction({
      image: Uint8Array.from([1, 2, 3]),
      mimeType: "image/jpeg",
      apiKey: "secret-key",
      model: "gemini-3.8-flash",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    expect(String(init.body)).not.toContain("secret-key");
  });

  it("maps an aborted request to timeout and does not retry malformed output", async () => {
    const timeout = vi.fn().mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const timed = await requestExtraction({
      image: Uint8Array.from([1]),
      mimeType: "image/png",
      apiKey: "secret-key",
      model: "gemini-3.8-flash",
      fetchImpl: timeout,
    });
    expect(timed).toEqual({ ok: false, code: "timeout" });
    expect(timeout).toHaveBeenCalledTimes(2);

    const malformed = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const bad = await requestExtraction({
      image: Uint8Array.from([1]),
      mimeType: "image/png",
      apiKey: "secret-key",
      model: "gemini-3.8-flash",
      fetchImpl: malformed,
    });
    expect(bad).toEqual({ ok: false, code: "malformed" });
    expect(malformed).toHaveBeenCalledTimes(1);
  });
});
