import {
  convertUsdCentsToThbSatang,
  isIsoDate,
  MAX_TOTAL_MINOR,
  MAX_UNIT_MINOR,
  parseMinor,
  parsePositiveInt,
  parseRateMilli,
} from "./money";
import type {
  BillDraft,
  ChargeAllocation,
  ChargeTreatment,
  Issue,
  IssueCode,
  Participant,
} from "./types";

const PEOPLE_CODES = new Set<IssueCode>([
  "no-participants",
  "participant-name",
  "participant-weight",
  "payer",
]);

const ITEM_CODES = new Set<IssueCode>([
  "no-items",
  "item-name",
  "item-quantity",
  "item-price",
  "item-unresolved",
  "vat-unresolved",
  "vat-amount",
  "service-unresolved",
  "service-amount",
  "currency",
  "rate",
  "rate-date",
  "printed-amount",
  "unsafe-amount",
]);

const ASSIGN_CODES = new Set<IssueCode>([
  "item-participants",
  "item-weights",
  "discrepancy",
  "acknowledgement",
  "unsafe-amount",
]);

export function issuesForStep(
  step: "people" | "items" | "assign",
  issues: readonly Issue[],
): Issue[] {
  const codes = step === "people" ? PEOPLE_CODES : step === "items" ? ITEM_CODES : ASSIGN_CODES;
  return issues.filter((issue) => codes.has(issue.code));
}

/**
 * Split `total` minor units by positive integer weights.
 * Largest remainder gets the leftover unit. Equal remainders go to the earlier entry.
 */
export function allocateMinor(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid total");
  if (weights.length === 0) throw new Error("No weights");
  let weightSum = 0;
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight <= 0) throw new Error("Invalid weight");
    weightSum += weight;
    if (!Number.isSafeInteger(weightSum)) throw new Error("Weight overflow");
  }
  const rows = weights.map((weight, index) => {
    const product = total * weight;
    if (!Number.isSafeInteger(product)) throw new Error("Amount overflow");
    return { index, base: Math.floor(product / weightSum), remainder: product % weightSum };
  });
  let leftover = total;
  for (const row of rows) leftover -= row.base;
  if (leftover < 0) throw new Error("Allocation drift");
  const ordered = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const row of ordered) {
    if (leftover === 0) break;
    row.base += 1;
    leftover -= 1;
  }
  if (leftover !== 0) throw new Error("Allocation remainder");
  const shares = new Array<number>(weights.length).fill(0);
  for (const row of rows) shares[row.index] = row.base;
  return shares;
}

export type ItemShare = { participantId: string; minor: number };

export type PersonShare = {
  participantId: string;
  itemMinor: number;
  vatMinor: number;
  serviceMinor: number;
  totalMinor: number;
  thbMinor: number;
};

export type SplitResult = {
  subtotalMinor: number;
  includedVatMinor: number | null;
  addedVatMinor: number;
  includedServiceMinor: number | null;
  addedServiceMinor: number;
  totalMinor: number;
  printedSubtotalMinor: number | null;
  printedTotalMinor: number | null;
  subtotalMismatch: boolean;
  totalMismatch: boolean;
  currency: "THB" | "USD";
  rateMilli: number;
  rateDate: string;
  thbTotalMinor: number;
  shares: PersonShare[];
  itemLines: { itemId: string; lineMinor: number; shares: ItemShare[] }[];
};

export type Evaluation = {
  issues: Issue[];
  result: SplitResult | null;
};

type ParsedPerson = { id: string; weight: number };

type ParsedItem = {
  id: string;
  quantity: number;
  unitMinor: number;
  lineMinor: number;
  participantIds: string[];
  splitMode: BillDraft["items"][number]["splitMode"];
};

function optionalPrinted(input: string, issues: Issue[]): number | null | undefined {
  if (input.trim() === "") return null;
  const minor = parseMinor(input, MAX_TOTAL_MINOR);
  if (minor === null) {
    issues.push({ code: "printed-amount" });
    return undefined;
  }
  return minor;
}

function readCharge(
  treatment: ChargeTreatment,
  amount: string,
  unresolved: IssueCode,
  missing: IssueCode,
  issues: Issue[],
): { added: number; included: number | null } | undefined {
  if (treatment === "unresolved") {
    issues.push({ code: unresolved });
    return undefined;
  }
  if (treatment === "none") return { added: 0, included: null };
  const parsed = amount.trim() === "" ? null : parseMinor(amount, MAX_TOTAL_MINOR);
  if (treatment === "included") {
    if (amount.trim() !== "" && parsed === null) issues.push({ code: missing });
    return { added: 0, included: parsed };
  }
  if (parsed === null) {
    issues.push({ code: missing });
    return undefined;
  }
  return { added: parsed, included: null };
}

function blocking(issues: readonly Issue[]): boolean {
  return issues.some((issue) => issue.code !== "discrepancy" && issue.code !== "acknowledgement");
}

export function evaluateBill(
  bill: BillDraft,
  participants: readonly Participant[],
  payerId: string,
): Evaluation {
  const issues: Issue[] = [];
  if (participants.length === 0) issues.push({ code: "no-participants" });
  const people: ParsedPerson[] = [];
  for (const person of participants) {
    if (person.name.trim().length === 0 || person.name.trim().length > 40) {
      issues.push({ code: "participant-name", participantId: person.id });
    }
    const weight = parsePositiveInt(person.weight, 1_000);
    if (weight === null) issues.push({ code: "participant-weight", participantId: person.id });
    people.push({ id: person.id, weight: weight ?? 0 });
  }
  if (participants.length > 0 && !people.some((person) => person.id === payerId)) {
    issues.push({ code: "payer" });
  }

  if (bill.items.length === 0) issues.push({ code: "no-items" });
  const knownIds = new Set(people.map((person) => person.id));
  const parsedItems: ParsedItem[] = [];
  for (const item of bill.items) {
    if (item.name.trim().length === 0 || item.name.trim().length > 80) {
      issues.push({ code: "item-name", itemId: item.id });
    }
    const quantity = parsePositiveInt(item.quantity, 999);
    if (quantity === null) issues.push({ code: "item-quantity", itemId: item.id });
    const unitMinor = parseMinor(item.unitPrice, MAX_UNIT_MINOR);
    if (unitMinor === null) issues.push({ code: "item-price", itemId: item.id });
    if (item.unresolved.length > 0) issues.push({ code: "item-unresolved", itemId: item.id });
    const uniqueParticipants = [...new Set(item.participantIds)].filter((id) => knownIds.has(id));
    if (uniqueParticipants.length === 0) issues.push({ code: "item-participants", itemId: item.id });
    if (item.splitMode === "weighted") {
      const selected = people.filter((person) => uniqueParticipants.includes(person.id));
      if (selected.length === 0 || selected.some((person) => person.weight <= 0)) {
        issues.push({ code: "item-weights", itemId: item.id });
      }
    }
    if (quantity !== null && unitMinor !== null) {
      const lineMinor = quantity * unitMinor;
      if (!Number.isSafeInteger(lineMinor) || lineMinor > MAX_TOTAL_MINOR) {
        issues.push({ code: "unsafe-amount", itemId: item.id });
      } else {
        parsedItems.push({
          id: item.id,
          quantity,
          unitMinor,
          lineMinor,
          participantIds: uniqueParticipants,
          splitMode: item.splitMode,
        });
      }
    }
  }

  const vat = readCharge(bill.vatTreatment, bill.vatAmount, "vat-unresolved", "vat-amount", issues);
  const service = readCharge(
    bill.serviceTreatment,
    bill.serviceAmount,
    "service-unresolved",
    "service-amount",
    issues,
  );
  if (bill.currency !== "THB" && bill.currency !== "USD") issues.push({ code: "currency" });
  let rateMilli = 10_000;
  if (bill.currency === "USD") {
    const parsedRate = parseRateMilli(bill.rate);
    if (parsedRate === null) issues.push({ code: "rate" });
    else rateMilli = parsedRate;
    if (!isIsoDate(bill.rateDate)) issues.push({ code: "rate-date" });
  }
  const printedSubtotalMinor = optionalPrinted(bill.printedSubtotal, issues);
  const printedTotalMinor = optionalPrinted(bill.printedTotal, issues);

  if (blocking(issues) || !vat || !service || printedSubtotalMinor === undefined || printedTotalMinor === undefined) {
    return { issues, result: null };
  }
  if (bill.currency !== "THB" && bill.currency !== "USD") return { issues, result: null };

  try {
    const itemShare = new Map<string, number>(people.map((person) => [person.id, 0]));
    const itemLines: SplitResult["itemLines"] = [];
    let subtotalMinor = 0;
    for (const item of parsedItems) {
      const selected = people.filter((person) => item.participantIds.includes(person.id));
      const weights =
        item.splitMode === "equal" ? selected.map(() => 1) : selected.map((person) => person.weight);
      const portions = allocateMinor(item.lineMinor, weights);
      const shares = selected.map((person, index) => ({
        participantId: person.id,
        minor: portions[index] ?? 0,
      }));
      for (const share of shares) {
        itemShare.set(share.participantId, (itemShare.get(share.participantId) ?? 0) + share.minor);
      }
      subtotalMinor += item.lineMinor;
      if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor > MAX_TOTAL_MINOR) {
        throw new Error("Amount overflow");
      }
      itemLines.push({ itemId: item.id, lineMinor: item.lineMinor, shares });
    }

    const base = people.filter((person) => (itemShare.get(person.id) ?? 0) > 0);
    const allocateCharge = (amount: number, mode: ChargeAllocation) => {
      const shares = new Map<string, number>(people.map((person) => [person.id, 0]));
      if (amount === 0) return shares;
      if (base.length === 0) throw new Error("No one to allocate a charge");
      const weights =
        mode === "equal" ? base.map(() => 1) : base.map((person) => itemShare.get(person.id) ?? 0);
      const portions = allocateMinor(amount, weights);
      base.forEach((person, index) => shares.set(person.id, portions[index] ?? 0));
      return shares;
    };

    const vatShares = allocateCharge(vat.added, bill.vatAllocation);
    const serviceShares = allocateCharge(service.added, bill.serviceAllocation);
    const totalMinor = subtotalMinor + vat.added + service.added;
    if (!Number.isSafeInteger(totalMinor) || totalMinor > MAX_TOTAL_MINOR) {
      throw new Error("Amount overflow");
    }

    const originals = people.map((person) => {
      const itemMinor = itemShare.get(person.id) ?? 0;
      const vatMinor = vatShares.get(person.id) ?? 0;
      const serviceMinor = serviceShares.get(person.id) ?? 0;
      return { person, itemMinor, vatMinor, serviceMinor, totalMinor: itemMinor + vatMinor + serviceMinor };
    });
    const originalSum = originals.reduce((sum, share) => sum + share.totalMinor, 0);
    if (originalSum !== totalMinor) throw new Error("Share drift");

    const thbTotalMinor =
      bill.currency === "USD" ? convertUsdCentsToThbSatang(totalMinor, rateMilli) : totalMinor;
    const thbById = new Map<string, number>(people.map((person) => [person.id, 0]));
    if (bill.currency === "THB") {
      for (const share of originals) thbById.set(share.person.id, share.totalMinor);
    } else {
      const holders = originals.filter((share) => share.totalMinor > 0);
      const portions = allocateMinor(
        thbTotalMinor,
        holders.map((share) => share.totalMinor),
      );
      holders.forEach((share, index) => thbById.set(share.person.id, portions[index] ?? 0));
    }
    const thbSum = [...thbById.values()].reduce((sum, value) => sum + value, 0);
    if (thbSum !== thbTotalMinor) throw new Error("THB drift");

    const subtotalMismatch = printedSubtotalMinor !== null && printedSubtotalMinor !== subtotalMinor;
    const totalMismatch = printedTotalMinor !== null && printedTotalMinor !== totalMinor;
    const note = bill.discrepancyNote.trim();
    if ((subtotalMismatch || totalMismatch) && (!bill.acknowledged || note.length === 0)) {
      issues.push({ code: "discrepancy" });
    }
    if (bill.warnings.length > 0 && !bill.acknowledged) issues.push({ code: "acknowledgement" });

    return {
      issues,
      result: {
        subtotalMinor,
        includedVatMinor: vat.included,
        addedVatMinor: vat.added,
        includedServiceMinor: service.included,
        addedServiceMinor: service.added,
        totalMinor,
        printedSubtotalMinor,
        printedTotalMinor,
        subtotalMismatch,
        totalMismatch,
        currency: bill.currency,
        rateMilli,
        rateDate: bill.currency === "USD" ? bill.rateDate : "",
        thbTotalMinor,
        shares: originals.map((share) => ({
          participantId: share.person.id,
          itemMinor: share.itemMinor,
          vatMinor: share.vatMinor,
          serviceMinor: share.serviceMinor,
          totalMinor: share.totalMinor,
          thbMinor: thbById.get(share.person.id) ?? 0,
        })),
        itemLines,
      },
    };
  } catch {
    issues.push({ code: "unsafe-amount" });
    return { issues, result: null };
  }
}
