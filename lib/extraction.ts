import { z } from "zod";
import { formatMinorPlain, MAX_TOTAL_MINOR, MAX_UNIT_MINOR, parseMinor } from "./money";
import type { ChargeTreatment, CurrencyCode, ExtractedDraft, ExtractedItem } from "./types";

const moneyPattern = /^\d+(\.\d{1,2})?$/;

function coerceMoney(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const minor = Math.round(value * 100);
    if (!Number.isSafeInteger(minor)) return value;
    if (Math.abs(minor / 100 - value) > 1e-6) return value;
    const whole = Math.trunc(minor / 100);
    const fraction = Math.abs(minor % 100);
    return `${whole}.${fraction.toString().padStart(2, "0")}`;
  }
  if (typeof value !== "string") return value;
  return value
    .trim()
    .replace(/บาท/gi, "")
    .replace(/[฿$,\s]/g, "");
}

function coerceNullableMoney(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  const coerced = coerceMoney(value);
  if (typeof coerced === "string" && coerced === "") return null;
  return coerced;
}

const nullableMoney = z.preprocess(
  coerceNullableMoney,
  z.union([z.string().regex(moneyPattern), z.null()]),
);

const treatment = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase();
}, z.enum(["included", "added", "none", "unresolved"]));

const currency = z.preprocess((value) => {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (code === "THB" || code === "BAHT" || code === "บาท") return "THB";
  if (code === "USD" || code === "US$" || code === "$") return "USD";
  return null;
}, z.enum(["THB", "USD"]).nullable());

const providerItem = z.object({
  name: z.string(),
  quantity: z.preprocess((value) => {
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
    return value;
  }, z.int().min(1).max(999)),
  unitPrice: nullableMoney,
  lineTotal: nullableMoney,
  priceBasis: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    return value.trim().toLowerCase();
  }, z.enum(["unit", "line", "ambiguous"])),
  unresolved: z.array(z.string()).max(10).optional(),
});

const charge = z.object({
  treatment,
  amount: nullableMoney,
});

const providerReceipt = z.object({
  merchant: z.string().nullable(),
  currency,
  items: z.array(providerItem).max(100),
  vat: charge,
  service: charge,
  printedSubtotal: nullableMoney,
  printedTotal: nullableMoney,
  warnings: z.array(z.string()).max(20).optional(),
});

function cleanText(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function canonical(value: string | null, max: number): string {
  if (!value) return "";
  const minor = parseMinor(value, max);
  return minor === null ? "" : formatMinorPlain(minor);
}

function normalizeItem(raw: z.infer<typeof providerItem>): ExtractedItem {
  const assumptions: string[] = [];
  const unresolved: string[] = [];
  let quantity = raw.quantity;
  let unit = raw.unitPrice;
  const line = raw.lineTotal;

  if (raw.priceBasis === "line") {
    unit = line ?? unit;
    quantity = 1;
    assumptions.push("assumed-quantity");
  } else if (raw.priceBasis === "ambiguous") {
    unresolved.push("ambiguous-price");
    if (!unit && line) {
      unit = line;
      quantity = 1;
      assumptions.push("assumed-quantity");
    }
  } else if (unit && line) {
    const unitMinor = parseMinor(unit, MAX_UNIT_MINOR);
    const lineMinor = parseMinor(line, MAX_TOTAL_MINOR);
    if (unitMinor !== null && lineMinor !== null && unitMinor * quantity !== lineMinor) {
      unresolved.push("unit-line-mismatch");
    }
  } else if (!unit && line) {
    unresolved.push("ambiguous-price");
    unit = line;
    quantity = 1;
    assumptions.push("assumed-quantity");
  }

  for (const note of raw.unresolved ?? []) {
    const cleaned = cleanText(note, 200);
    if (cleaned && !unresolved.includes(cleaned)) unresolved.push(cleaned);
  }

  return {
    name: cleanText(raw.name, 80),
    quantity,
    unitPrice: canonical(unit, MAX_UNIT_MINOR),
    assumptions,
    unresolved,
  };
}

function normalizeCharge(
  raw: z.infer<typeof charge>,
  warnings: string[],
): { treatment: ChargeTreatment; amount: string } {
  if (raw.treatment === "none" || raw.treatment === "unresolved") {
    return { treatment: raw.treatment, amount: "" };
  }
  const amount = canonical(raw.amount, MAX_TOTAL_MINOR);
  if (raw.amount && amount === "") warnings.push("unreadable-amount");
  return { treatment: raw.treatment, amount };
}

export function parseProviderPayload(input: unknown): ExtractedDraft | null {
  const parsed = providerReceipt.safeParse(input);
  if (!parsed.success) return null;
  const warnings = (parsed.data.warnings ?? [])
    .map((warning) => cleanText(warning, 300))
    .filter((warning) => warning.length > 0)
    .slice(0, 20);
  const vat = normalizeCharge(parsed.data.vat, warnings);
  const service = normalizeCharge(parsed.data.service, warnings);
  let items = parsed.data.items.map(normalizeItem);
  if (items.length > 80) {
    items = items.slice(0, 80);
    warnings.push("kept-first-80-items");
  }
  const printedSubtotal = canonical(parsed.data.printedSubtotal, MAX_TOTAL_MINOR);
  const printedTotal = canonical(parsed.data.printedTotal, MAX_TOTAL_MINOR);
  if (parsed.data.printedSubtotal && printedSubtotal === "") warnings.push("printed-unreadable");
  if (parsed.data.printedTotal && printedTotal === "") warnings.push("printed-unreadable");
  const currencyCode: CurrencyCode | "" = parsed.data.currency ?? "";
  return {
    merchant: parsed.data.merchant ? cleanText(parsed.data.merchant, 80) : "",
    currency: currencyCode,
    items,
    vatTreatment: vat.treatment,
    vatAmount: vat.amount,
    serviceTreatment: service.treatment,
    serviceAmount: service.amount,
    printedSubtotal,
    printedTotal,
    warnings,
  };
}

const treatments = new Set(["included", "added", "none", "unresolved"]);

export function isExtractedDraft(value: unknown): value is ExtractedDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ExtractedDraft>;
  if (typeof draft.merchant !== "string") return false;
  if (draft.currency !== "THB" && draft.currency !== "USD" && draft.currency !== "") return false;
  if (typeof draft.vatTreatment !== "string" || !treatments.has(draft.vatTreatment)) return false;
  if (typeof draft.serviceTreatment !== "string" || !treatments.has(draft.serviceTreatment)) return false;
  if (typeof draft.vatAmount !== "string" || typeof draft.serviceAmount !== "string") return false;
  if (typeof draft.printedSubtotal !== "string" || typeof draft.printedTotal !== "string") return false;
  if (!Array.isArray(draft.warnings) || draft.warnings.some((warning) => typeof warning !== "string")) {
    return false;
  }
  if (!Array.isArray(draft.items)) return false;
  return draft.items.every(
    (item) =>
      !!item &&
      typeof item.name === "string" &&
      typeof item.quantity === "number" &&
      typeof item.unitPrice === "string" &&
      Array.isArray(item.assumptions) &&
      Array.isArray(item.unresolved),
  );
}
