import { describe, expect, it } from "vitest";
import { defaultParticipants, sampleBill } from "./sample";
import { allocateMinor, evaluateBill, issuesForStep } from "./split";
import type { BillDraft, Participant } from "./types";

const people: Participant[] = [
  { id: "a", name: "เอ", weight: "1" },
  { id: "b", name: "บี", weight: "1" },
];

function bill(patch: Partial<BillDraft>): BillDraft {
  return {
    merchant: "",
    currency: "THB",
    items: [
      {
        id: "line",
        name: "ข้าว",
        quantity: "1",
        unitPrice: "100.00",
        participantIds: ["a", "b"],
        splitMode: "equal",
        assumptions: [],
        unresolved: [],
      },
    ],
    vatTreatment: "none",
    vatAmount: "",
    vatAllocation: "equal",
    serviceTreatment: "none",
    serviceAmount: "",
    serviceAllocation: "equal",
    printedSubtotal: "",
    printedTotal: "",
    rate: "",
    rateDate: "",
    warnings: [],
    simulated: false,
    source: "manual",
    discrepancyNote: "",
    acknowledged: false,
    ...patch,
  };
}

describe("allocateMinor", () => {
  it("gives the leftover satang to the earliest person when remainders tie", () => {
    expect(allocateMinor(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateMinor(1, [1, 1])).toEqual([1, 0]);
  });

  it("splits 60/40 exactly and conserves odd totals", () => {
    expect(allocateMinor(10_000, [60, 40])).toEqual([6_000, 4_000]);
    for (const total of [0, 1, 2, 99, 100, 4_450]) {
      for (const weights of [[1], [1, 1], [1, 1, 1], [3, 1], [60, 40], [1, 2, 3, 4]]) {
        const shares = allocateMinor(total, weights);
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
      }
    }
  });

  it("rejects empty or overflowing weights", () => {
    expect(() => allocateMinor(10, [])).toThrow();
    expect(() => allocateMinor(Number.MAX_SAFE_INTEGER, [2])).toThrow();
  });
});

describe("evaluateBill", () => {
  it("keeps included VAT informational and adds service once", () => {
    const included = evaluateBill(
      bill({ vatTreatment: "included", vatAmount: "7.00", serviceTreatment: "added", serviceAmount: "10.00" }),
      people,
      "a",
    );
    expect(included.issues).toEqual([]);
    expect(included.result?.totalMinor).toBe(11_000);
    expect(included.result?.includedVatMinor).toBe(700);
    expect(included.result?.addedServiceMinor).toBe(1_000);
    expect(included.result?.shares.map((share) => share.totalMinor)).toEqual([5_500, 5_500]);
  });

  it("allocates added VAT equally and blocks an unresolved treatment", () => {
    const added = evaluateBill(
      bill({ vatTreatment: "added", vatAmount: "7.00", vatAllocation: "equal" }),
      people,
      "a",
    );
    expect(added.result?.totalMinor).toBe(10_700);
    expect(added.result?.shares.map((share) => share.vatMinor)).toEqual([350, 350]);

    const unresolved = evaluateBill(bill({ vatTreatment: "unresolved" }), people, "a");
    expect(unresolved.result).toBeNull();
    expect(unresolved.issues.map((issue) => issue.code)).toContain("vat-unresolved");
  });

  it("requires a note when the printed total disagrees", () => {
    const open = evaluateBill(bill({ printedTotal: "99.99" }), people, "a");
    expect(open.result?.totalMismatch).toBe(true);
    expect(open.issues.map((issue) => issue.code)).toContain("discrepancy");
    expect(issuesForStep("items", open.issues).map((issue) => issue.code)).not.toContain("discrepancy");

    const closed = evaluateBill(
      bill({ printedTotal: "99.99", acknowledged: true, discrepancyNote: "ส่วนลดที่แคชเชียร์ลบให้" }),
      people,
      "a",
    );
    expect(closed.issues).toEqual([]);
  });

  it("converts the whole USD total to THB before splitting that total", () => {
    const evaluation = evaluateBill(
      bill({
        currency: "USD",
        rate: "35.50",
        rateDate: "2026-11-01",
        items: [
          {
            id: "line",
            name: "tea",
            quantity: "1",
            unitPrice: "10.00",
            participantIds: ["a", "b"],
            splitMode: "equal",
            assumptions: [],
            unresolved: [],
          },
        ],
      }),
      people,
      "a",
    );
    expect(evaluation.issues).toEqual([]);
    expect(evaluation.result?.totalMinor).toBe(1_000);
    expect(evaluation.result?.thbTotalMinor).toBe(35_500);
    expect(evaluation.result?.shares.map((share) => share.thbMinor)).toEqual([17_750, 17_750]);
  });

  it("rejects an exchange that cannot be rounded safely", () => {
    const evaluation = evaluateBill(
      bill({
        currency: "USD",
        rate: "10000",
        rateDate: "2026-11-01",
        items: [
          {
            id: "line",
            name: "tea",
            quantity: "1",
            unitPrice: "1000000.00",
            participantIds: ["a"],
            splitMode: "equal",
            assumptions: [],
            unresolved: [],
          },
        ],
      }),
      [people[0]],
      "a",
    );
    expect(evaluation.result).toBeNull();
    expect(evaluation.issues.map((issue) => issue.code)).toContain("unsafe-amount");
  });

  it("balances the fictional sample receipt", () => {
    const ids = defaultParticipants.map((person) => person.id);
    const evaluation = evaluateBill(sampleBill(ids), defaultParticipants, "p-may");
    expect(evaluation.issues).toEqual([]);
    const result = evaluation.result;
    if (!result) throw new Error("expected a result");
    expect(result.subtotalMinor).toBe(44_500);
    expect(result.totalMinor).toBe(48_950);
    expect(result.includedVatMinor).toBe(2_911);
    expect(result.shares.map((share) => share.itemMinor)).toEqual([14_834, 14_833, 14_833]);
    expect(result.shares.reduce((sum, share) => sum + share.totalMinor, 0)).toBe(48_950);
    expect(result.shares.reduce((sum, share) => sum + share.thbMinor, 0)).toBe(48_950);
  });
});
