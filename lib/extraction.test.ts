import { describe, expect, it } from "vitest";
import { parseProviderPayload } from "./extraction";

const base = {
  merchant: "ร้านทดสอบ",
  currency: "THB",
  vat: { treatment: "included", amount: "7.00" },
  service: { treatment: "none", amount: null },
  printedSubtotal: "100.00",
  printedTotal: "100.00",
  warnings: [],
};

describe("parseProviderPayload", () => {
  it("turns a line total into quantity 1 and records the assumption", () => {
    const draft = parseProviderPayload({
      ...base,
      items: [
        {
          name: "น้ำ",
          quantity: 2,
          unitPrice: null,
          lineTotal: "30.00",
          priceBasis: "line",
          unresolved: [],
        },
      ],
    });
    expect(draft?.items[0]).toMatchObject({
      name: "น้ำ",
      quantity: 1,
      unitPrice: "30.00",
      assumptions: ["assumed-quantity"],
    });
  });

  it("flags a unit price that does not match the line total", () => {
    const draft = parseProviderPayload({
      ...base,
      items: [
        {
          name: "ข้าว",
          quantity: 2,
          unitPrice: "10.00",
          lineTotal: "25.00",
          priceBasis: "unit",
          unresolved: [],
        },
      ],
    });
    expect(draft?.items[0]?.unitPrice).toBe("10.00");
    expect(draft?.items[0]?.quantity).toBe(2);
    expect(draft?.items[0]?.unresolved).toContain("unit-line-mismatch");
  });

  it("leaves an unsupported currency for the user and strips a baht sign", () => {
    const draft = parseProviderPayload({
      ...base,
      currency: "EUR",
      printedTotal: "฿100.00",
      items: [
        {
          name: "ชา",
          quantity: "1",
          unitPrice: "100.00",
          lineTotal: "100.00",
          priceBasis: "unit",
        },
      ],
    });
    expect(draft?.currency).toBe("");
    expect(draft?.printedTotal).toBe("100.00");
  });

  it("rejects malformed provider JSON", () => {
    expect(parseProviderPayload({ items: "nope" })).toBeNull();
    expect(parseProviderPayload("not json")).toBeNull();
  });
});
