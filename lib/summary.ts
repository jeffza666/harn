import { flagLabel, labels } from "./labels";
import { formatMinor } from "./money";
import type { SplitResult } from "./split";
import type { BillDraft, Participant } from "./types";

function money(minor: number, currency: BillDraft["currency"]): string {
  const amount = formatMinor(minor);
  return currency === "USD" ? `${amount} ${labels.usdCode}` : `${amount} ${labels.baht}`;
}

function baht(minor: number): string {
  return `${formatMinor(minor)} ${labels.baht}`;
}

function allocationLabel(mode: BillDraft["vatAllocation"]): string {
  return mode === "equal" ? labels.allocationEqual : labels.allocationProportional;
}

export function buildSummary(
  bill: BillDraft,
  participants: readonly Participant[],
  payerId: string,
  result: SplitResult,
): string {
  const names = new Map(participants.map((person) => [person.id, person.name.trim()]));
  const payerName = names.get(payerId) ?? "";
  const lines: string[] = [
    `${labels.appName} — ${labels.steps.summary}`,
    bill.simulated ? labels.simulatedBadge : bill.source === "upload" ? labels.realBadge : labels.manualBadge,
  ];
  if (bill.merchant.trim()) lines.push(`${labels.merchant}: ${bill.merchant.trim()}`);
  lines.push(`${labels.currency}: ${bill.currency === "USD" ? "USD" : "THB"}`);
  lines.push(`${labels.payer}: ${payerName}`);
  if (bill.currency === "USD") {
    lines.push(`${labels.rateUsed}: ${bill.rate} (${bill.rateDate})`);
    lines.push(`${labels.usdThbTotal}: ${baht(result.thbTotalMinor)}`);
  }
  lines.push("");
  lines.push(labels.steps.items);
  for (const item of bill.items) {
    const line = result.itemLines.find((entry) => entry.itemId === item.id);
    const people = (line?.shares ?? [])
      .map((share) => names.get(share.participantId))
      .filter((name): name is string => Boolean(name))
      .join(", ");
    const mode = item.splitMode === "equal" ? labels.splitEqual : labels.splitWeighted;
    const amount = line ? money(line.lineMinor, bill.currency) : "";
    lines.push(`- ${item.name.trim()} × ${item.quantity} = ${amount} · ${people} · ${mode}`);
  }
  lines.push("");
  lines.push(`${labels.calculatedSubtotal}: ${money(result.subtotalMinor, bill.currency)}`);
  if (result.includedVatMinor !== null) {
    lines.push(`${labels.includedVatLine}: ${money(result.includedVatMinor, bill.currency)} (${labels.notAdded})`);
  }
  if (result.addedVatMinor > 0) {
    lines.push(
      `${labels.addedVatLine}: ${money(result.addedVatMinor, bill.currency)} · ${allocationLabel(bill.vatAllocation)}`,
    );
  }
  if (result.includedServiceMinor !== null) {
    lines.push(
      `${labels.includedServiceLine}: ${money(result.includedServiceMinor, bill.currency)} (${labels.notAdded})`,
    );
  }
  if (result.addedServiceMinor > 0) {
    lines.push(
      `${labels.addedServiceLine}: ${money(result.addedServiceMinor, bill.currency)} · ${allocationLabel(bill.serviceAllocation)}`,
    );
  }
  lines.push(`${labels.calculatedTotal}: ${money(result.totalMinor, bill.currency)}`);
  if (result.subtotalMismatch || result.totalMismatch) {
    lines.push(`${labels.comparisonMismatch}: ${bill.discrepancyNote.trim()}`);
  }
  lines.push("");
  for (const share of result.shares) {
    const name = names.get(share.participantId) ?? share.participantId;
    lines.push(name);
    lines.push(`- ${labels.responsibility}: ${baht(share.thbMinor)}`);
    if (share.participantId === payerId) {
      lines.push(`- ${labels.paidBy}: ${baht(result.thbTotalMinor)}`);
      lines.push(`- ${labels.receives}: ${baht(result.thbTotalMinor - share.thbMinor)}`);
    } else if (share.thbMinor > 0) {
      lines.push(`- ${labels.owes} ${payerName}: ${baht(share.thbMinor)}`);
    } else {
      lines.push(`- ${labels.noShare}`);
    }
  }
  if (bill.warnings.length > 0) {
    lines.push("");
    lines.push(labels.warnings);
    for (const warning of bill.warnings) lines.push(`- ${flagLabel(warning)}`);
  }
  lines.push("");
  lines.push(labels.transferNote);
  return lines.join("\n");
}
