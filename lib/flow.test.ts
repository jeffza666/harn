import { describe, expect, it } from "vitest";
import { createFlowState, flowReducer } from "./flow";
import { evaluateBill } from "./split";

describe("flowReducer", () => {
  it("opens the demo on a balanced sample bill", () => {
    const state = createFlowState(true);
    expect(state.step).toBe("items");
    expect(state.bill.simulated).toBe(true);
    expect(evaluateBill(state.bill, state.participants, state.payerId).issues).toEqual([]);
  });

  it("removes a person from items and keeps a payer", () => {
    const removed = flowReducer(createFlowState(true), { type: "remove-participant", id: "p-may" });
    expect(removed.payerId).toBe("p-ton");
    expect(removed.bill.items.every((item) => !item.participantIds.includes("p-may"))).toBe(true);
  });

  it("clears extraction flags when the price is edited", () => {
    let state = createFlowState(false);
    state = flowReducer(state, {
      type: "load-extracted",
      itemIds: ["item-1"],
      draft: {
        merchant: "ร้าน",
        currency: "THB",
        items: [
          {
            name: "ชา",
            quantity: 1,
            unitPrice: "40.00",
            assumptions: ["assumed-quantity"],
            unresolved: ["ambiguous-price"],
          },
        ],
        vatTreatment: "none",
        vatAmount: "",
        serviceTreatment: "none",
        serviceAmount: "",
        printedSubtotal: "",
        printedTotal: "",
        warnings: ["ส่วนลด"],
      },
    });
    expect(state.bill.source).toBe("upload");
    expect(state.bill.simulated).toBe(false);
    state = flowReducer(state, { type: "update-item", id: "item-1", patch: { unitPrice: "45.00" } });
    expect(state.bill.items[0]?.unresolved).toEqual([]);
    expect(state.bill.items[0]?.assumptions).toEqual([]);
    expect(state.bill.acknowledged).toBe(false);
  });
});
