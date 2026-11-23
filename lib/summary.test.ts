import { describe, expect, it } from "vitest";
import { createFlowState } from "./flow";
import { formatMinor } from "./money";
import { evaluateBill } from "./split";
import { buildSummary } from "./summary";

describe("buildSummary", () => {
  it("names the payer, the currency, and the amount to transfer", () => {
    const state = createFlowState(true);
    const evaluation = evaluateBill(state.bill, state.participants, state.payerId);
    if (!evaluation.result) throw new Error("expected a result");
    const text = buildSummary(state.bill, state.participants, state.payerId, evaluation.result);
    expect(text).toContain("เมย์");
    expect(text).toContain("ต้น");
    expect(text).toContain("THB");
    expect(text).toContain(formatMinor(evaluation.result.thbTotalMinor));
    expect(text).toContain("ต้องโอนให้ เมย์");
    expect(text).toContain("ผลลัพธ์จำลอง");
  });
});
