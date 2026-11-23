import { labels } from "@/lib/labels";
import { formatMinor } from "@/lib/money";
import type { SplitResult } from "@/lib/split";
import type { BillDraft } from "@/lib/types";

function amount(minor: number, currency: BillDraft["currency"]) {
  return `${formatMinor(minor)} ${currency === "USD" ? labels.usdCode : labels.baht}`;
}

export function Totals({ bill, result }: { bill: BillDraft; result: SplitResult }) {
  return (
    <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
      <div>
        <dt>{labels.calculatedSubtotal}</dt>
        <dd className="font-semibold text-slate-900">{amount(result.subtotalMinor, bill.currency)}</dd>
      </div>
      {result.includedVatMinor !== null ? (
        <div>
          <dt>
            {labels.includedVatLine} ({labels.notAdded})
          </dt>
          <dd className="font-semibold text-slate-900">{amount(result.includedVatMinor, bill.currency)}</dd>
        </div>
      ) : null}
      {result.addedVatMinor > 0 ? (
        <div>
          <dt>{labels.addedVatLine}</dt>
          <dd className="font-semibold text-slate-900">{amount(result.addedVatMinor, bill.currency)}</dd>
        </div>
      ) : null}
      {result.includedServiceMinor !== null ? (
        <div>
          <dt>
            {labels.includedServiceLine} ({labels.notAdded})
          </dt>
          <dd className="font-semibold text-slate-900">{amount(result.includedServiceMinor, bill.currency)}</dd>
        </div>
      ) : null}
      {result.addedServiceMinor > 0 ? (
        <div>
          <dt>{labels.addedServiceLine}</dt>
          <dd className="font-semibold text-slate-900">{amount(result.addedServiceMinor, bill.currency)}</dd>
        </div>
      ) : null}
      <div>
        <dt>{labels.calculatedTotal}</dt>
        <dd className="text-lg font-bold text-slate-900">{amount(result.totalMinor, bill.currency)}</dd>
      </div>
      {bill.currency === "USD" ? (
        <div>
          <dt>{labels.usdThbTotal}</dt>
          <dd className="text-lg font-bold text-slate-900">
            {formatMinor(result.thbTotalMinor)} {labels.baht}
          </dd>
        </div>
      ) : null}
      {result.printedSubtotalMinor !== null ? (
        <div>
          <dt>{labels.printedSubtotal}</dt>
          <dd className={result.subtotalMismatch ? "font-semibold text-rose-700" : "font-semibold text-emerald-800"}>
            {amount(result.printedSubtotalMinor, bill.currency)} ·{" "}
            {result.subtotalMismatch ? labels.comparisonMismatch : labels.comparisonMatch}
          </dd>
        </div>
      ) : null}
      {result.printedTotalMinor !== null ? (
        <div>
          <dt>{labels.printedTotal}</dt>
          <dd className={result.totalMismatch ? "font-semibold text-rose-700" : "font-semibold text-emerald-800"}>
            {amount(result.printedTotalMinor, bill.currency)} ·{" "}
            {result.totalMismatch ? labels.comparisonMismatch : labels.comparisonMatch}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
