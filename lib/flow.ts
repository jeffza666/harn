import { blankItem, defaultParticipants, emptyBill, sampleBill } from "./sample";
import type { BillDraft, ExtractedDraft, ItemDraft, Participant, Step } from "./types";

export const MAX_PARTICIPANTS = 12;
export const MAX_ITEMS = 80;

export type FlowState = {
  step: Step;
  participants: Participant[];
  payerId: string;
  bill: BillDraft;
};

export type FlowAction =
  | { type: "set-step"; step: Step }
  | { type: "add-participant"; id: string }
  | { type: "remove-participant"; id: string }
  | { type: "update-participant"; id: string; name?: string; weight?: string }
  | { type: "set-payer"; id: string }
  | { type: "add-item"; id: string }
  | { type: "remove-item"; id: string }
  | {
      type: "update-item";
      id: string;
      patch: Partial<Pick<ItemDraft, "name" | "quantity" | "unitPrice" | "participantIds" | "splitMode">>;
    }
  | {
      type: "update-bill";
      patch: Partial<
        Pick<
          BillDraft,
          | "merchant"
          | "currency"
          | "vatTreatment"
          | "vatAmount"
          | "vatAllocation"
          | "serviceTreatment"
          | "serviceAmount"
          | "serviceAllocation"
          | "printedSubtotal"
          | "printedTotal"
          | "rate"
          | "rateDate"
        >
      >;
    }
  | { type: "set-note"; note: string }
  | { type: "acknowledge"; value: boolean }
  | { type: "load-sample" }
  | { type: "load-manual"; itemId: string }
  | { type: "clear-items" }
  | { type: "load-extracted"; draft: ExtractedDraft; itemIds: string[] };

function forgetAck(bill: BillDraft): BillDraft {
  return { ...bill, acknowledged: false };
}

function stripParticipant(bill: BillDraft, participantId: string): BillDraft {
  return forgetAck({
    ...bill,
    items: bill.items.map((item) => ({
      ...item,
      participantIds: item.participantIds.filter((id) => id !== participantId),
    })),
  });
}

function itemsFromExtracted(draft: ExtractedDraft, participantIds: string[], itemIds: string[]): ItemDraft[] {
  return draft.items.map((item, index) => ({
    id: itemIds[index] ?? `extracted-${index + 1}`,
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: item.unitPrice,
    participantIds: [...participantIds],
    splitMode: "equal",
    assumptions: [...item.assumptions],
    unresolved: [...item.unresolved],
  }));
}

export function createFlowState(demo: boolean): FlowState {
  const participants = defaultParticipants.map((person) => ({ ...person }));
  if (!demo) {
    return { step: "people", participants, payerId: participants[0].id, bill: emptyBill() };
  }
  return {
    step: "items",
    participants,
    payerId: participants[0].id,
    bill: sampleBill(participants.map((person) => person.id)),
  };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "set-step":
      return { ...state, step: action.step };
    case "add-participant": {
      if (state.participants.length >= MAX_PARTICIPANTS) return state;
      if (state.participants.some((person) => person.id === action.id)) return state;
      return {
        ...state,
        participants: [...state.participants, { id: action.id, name: "", weight: "1" }],
      };
    }
    case "remove-participant": {
      if (state.participants.length <= 1) return state;
      const participants = state.participants.filter((person) => person.id !== action.id);
      const payerId = participants.some((person) => person.id === state.payerId)
        ? state.payerId
        : participants[0].id;
      return { ...state, participants, payerId, bill: stripParticipant(state.bill, action.id) };
    }
    case "update-participant":
      return {
        ...state,
        participants: state.participants.map((person) =>
          person.id === action.id
            ? {
                ...person,
                name: action.name ?? person.name,
                weight: action.weight ?? person.weight,
              }
            : person,
        ),
      };
    case "set-payer":
      if (!state.participants.some((person) => person.id === action.id)) return state;
      return { ...state, payerId: action.id };
    case "add-item": {
      if (state.bill.items.length >= MAX_ITEMS) return state;
      return {
        ...state,
        bill: forgetAck({
          ...state.bill,
          items: [...state.bill.items, blankItem(action.id, state.participants.map((person) => person.id))],
        }),
      };
    }
    case "remove-item":
      return {
        ...state,
        bill: forgetAck({
          ...state.bill,
          items: state.bill.items.filter((item) => item.id !== action.id),
        }),
      };
    case "update-item":
      return {
        ...state,
        bill: forgetAck({
          ...state.bill,
          items: state.bill.items.map((item) => {
            if (item.id !== action.id) return item;
            const next = { ...item, ...action.patch };
            if ("quantity" in action.patch || "unitPrice" in action.patch) {
              next.assumptions = [];
              next.unresolved = [];
            }
            return next;
          }),
        }),
      };
    case "update-bill": {
      const patch = { ...action.patch };
      if (patch.vatTreatment === "none" || patch.vatTreatment === "unresolved") patch.vatAmount = "";
      if (patch.serviceTreatment === "none" || patch.serviceTreatment === "unresolved") {
        patch.serviceAmount = "";
      }
      return { ...state, bill: forgetAck({ ...state.bill, ...patch }) };
    }
    case "set-note":
      return { ...state, bill: { ...state.bill, discrepancyNote: action.note.slice(0, 300) } };
    case "acknowledge":
      return { ...state, bill: { ...state.bill, acknowledged: action.value } };
    case "load-sample":
      return {
        ...state,
        step: "items",
        bill: sampleBill(state.participants.map((person) => person.id)),
      };
    case "load-manual":
      return {
        ...state,
        step: "items",
        bill: {
          ...emptyBill(),
          currency: "THB",
          source: "manual",
          items: [blankItem(action.itemId, state.participants.map((person) => person.id))],
        },
      };
    case "clear-items":
      return { ...state, bill: forgetAck({ ...state.bill, items: [], simulated: false }) };
    case "load-extracted":
      return {
        ...state,
        step: "items",
        bill: {
          ...emptyBill(),
          merchant: action.draft.merchant,
          currency: action.draft.currency,
          items: itemsFromExtracted(
            action.draft,
            state.participants.map((person) => person.id),
            action.itemIds,
          ),
          vatTreatment: action.draft.vatTreatment,
          vatAmount: action.draft.vatAmount,
          serviceTreatment: action.draft.serviceTreatment,
          serviceAmount: action.draft.serviceAmount,
          printedSubtotal: action.draft.printedSubtotal,
          printedTotal: action.draft.printedTotal,
          warnings: [...action.draft.warnings],
          simulated: false,
          source: "upload",
        },
      };
    default:
      return state;
  }
}
