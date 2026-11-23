import type { BillDraft, ItemDraft, Participant } from "./types";

export const defaultParticipants: Participant[] = [
  { id: "p-may", name: "เมย์", weight: "1" },
  { id: "p-ton", name: "ต้น", weight: "1" },
  { id: "p-jay", name: "เจ", weight: "1" },
];

const emptyCharges = {
  vatTreatment: "none" as const,
  vatAmount: "",
  vatAllocation: "proportional" as const,
  serviceTreatment: "none" as const,
  serviceAmount: "",
  serviceAllocation: "proportional" as const,
  printedSubtotal: "",
  printedTotal: "",
  rate: "",
  rateDate: "",
  warnings: [] as string[],
  discrepancyNote: "",
  acknowledged: false,
};

export function blankItem(id: string, participantIds: readonly string[]): ItemDraft {
  return {
    id,
    name: "",
    quantity: "1",
    unitPrice: "",
    participantIds: [...participantIds],
    splitMode: "equal",
    assumptions: [],
    unresolved: [],
  };
}

export function emptyBill(): BillDraft {
  return {
    merchant: "",
    currency: "THB",
    items: [],
    ...emptyCharges,
    simulated: false,
    source: null,
  };
}

export function sampleBill(participantIds: readonly string[]): BillDraft {
  const share = [...participantIds];
  const item = (
    id: string,
    name: string,
    quantity: string,
    unitPrice: string,
  ): ItemDraft => ({
    id,
    name,
    quantity,
    unitPrice,
    participantIds: share,
    splitMode: "equal",
    assumptions: [],
    unresolved: [],
  });
  return {
    merchant: "ครัวตัวอย่าง",
    currency: "THB",
    items: [
      item("item-rice", "ข้าวผัดกุ้ง", "1", "120.00"),
      item("item-tomyum", "ต้มยำกุ้ง", "1", "180.00"),
      item("item-water", "น้ำเปล่า", "3", "15.00"),
      item("item-mango", "มะม่วง", "1", "100.00"),
    ],
    vatTreatment: "included",
    vatAmount: "29.11",
    vatAllocation: "proportional",
    serviceTreatment: "added",
    serviceAmount: "44.50",
    serviceAllocation: "proportional",
    printedSubtotal: "445.00",
    printedTotal: "489.50",
    rate: "",
    rateDate: "",
    warnings: [],
    simulated: true,
    source: "sample",
    discrepancyNote: "",
    acknowledged: false,
  };
}
