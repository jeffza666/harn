export type CurrencyCode = "THB" | "USD";

export type ChargeTreatment = "included" | "added" | "none" | "unresolved";

export type SplitMode = "equal" | "weighted";

export type ChargeAllocation = "equal" | "proportional";

export type BillSource = "sample" | "upload" | "manual";

export type Participant = {
  id: string;
  name: string;
  weight: string;
};

export type ItemDraft = {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
  participantIds: string[];
  splitMode: SplitMode;
  assumptions: string[];
  unresolved: string[];
};

export type BillDraft = {
  merchant: string;
  currency: CurrencyCode | "";
  items: ItemDraft[];
  vatTreatment: ChargeTreatment;
  vatAmount: string;
  vatAllocation: ChargeAllocation;
  serviceTreatment: ChargeTreatment;
  serviceAmount: string;
  serviceAllocation: ChargeAllocation;
  printedSubtotal: string;
  printedTotal: string;
  rate: string;
  rateDate: string;
  warnings: string[];
  simulated: boolean;
  source: BillSource | null;
  discrepancyNote: string;
  acknowledged: boolean;
};

export type ExtractedItem = {
  name: string;
  quantity: number;
  unitPrice: string;
  assumptions: string[];
  unresolved: string[];
};

export type ExtractedDraft = {
  merchant: string;
  currency: CurrencyCode | "";
  items: ExtractedItem[];
  vatTreatment: ChargeTreatment;
  vatAmount: string;
  serviceTreatment: ChargeTreatment;
  serviceAmount: string;
  printedSubtotal: string;
  printedTotal: string;
  warnings: string[];
};

export type IssueCode =
  | "no-items"
  | "item-name"
  | "item-quantity"
  | "item-price"
  | "item-unresolved"
  | "item-participants"
  | "item-weights"
  | "participant-name"
  | "participant-weight"
  | "no-participants"
  | "payer"
  | "vat-unresolved"
  | "vat-amount"
  | "service-unresolved"
  | "service-amount"
  | "currency"
  | "rate"
  | "rate-date"
  | "printed-amount"
  | "discrepancy"
  | "acknowledgement"
  | "unsafe-amount";

export type Issue = {
  code: IssueCode;
  itemId?: string;
  participantId?: string;
};

export type ExtractErrorCode =
  | "not_configured"
  | "bad_model"
  | "rate_limited"
  | "invalid_image"
  | "unsupported_type"
  | "heic"
  | "too_large"
  | "quota"
  | "timeout"
  | "provider"
  | "malformed"
  | "refused"
  | "auth";

export type PrepareErrorCode =
  | "heic"
  | "too-large"
  | "unsupported"
  | "empty"
  | "decode"
  | "too-large-output";

export type Step = "people" | "capture" | "items" | "assign" | "summary";
