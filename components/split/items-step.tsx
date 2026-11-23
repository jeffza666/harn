import type { Dispatch } from "react";
import { Totals } from "@/components/split/totals";
import { Banner, Button, Card, issueFor, TextField } from "@/components/split/ui";
import { MAX_ITEMS, type FlowAction, type FlowState } from "@/lib/flow";
import { flagLabel, issueText, labels } from "@/lib/labels";
import { formatMinor, MAX_TOTAL_MINOR, parseMinor, parsePositiveInt } from "@/lib/money";
import type { SplitResult } from "@/lib/split";
import type { ChargeTreatment, Issue, ItemDraft } from "@/lib/types";

const treatments: ChargeTreatment[] = ["included", "added", "none", "unresolved"];

const treatmentLabel: Record<ChargeTreatment, string> = {
  included: labels.treatmentIncluded,
  added: labels.treatmentAdded,
  none: labels.treatmentNone,
  unresolved: labels.treatmentUnresolved,
};

function lineAmount(item: ItemDraft): string {
  const quantity = parsePositiveInt(item.quantity, 999);
  const price = parseMinor(item.unitPrice);
  if (quantity === null || price === null) return "—";
  const line = quantity * price;
  return Number.isSafeInteger(line) ? formatMinor(line) : "—";
}

function ChargeFields({
  title,
  treatment,
  amount,
  issues,
  unresolvedCode,
  amountCode,
  onTreatment,
  onAmount,
}: {
  title: string;
  treatment: ChargeTreatment;
  amount: string;
  issues: Issue[];
  unresolvedCode: "vat-unresolved" | "service-unresolved";
  amountCode: "vat-amount" | "service-amount";
  onTreatment: (treatment: ChargeTreatment) => void;
  onAmount: (amount: string) => void;
}) {
  const name = title === labels.vat ? "vat-treatment" : "service-treatment";
  const showAmount = treatment === "included" || treatment === "added";
  return (
    <Card>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">{title}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {treatments.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name={name}
                checked={treatment === option}
                onChange={() => onTreatment(option)}
              />
              {treatmentLabel[option]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {treatment === "included"
            ? labels.includedHelp
            : treatment === "added"
              ? labels.addedHelp
              : treatment === "none"
                ? labels.noneHelp
                : labels.unresolvedHelp}
        </p>
        {issueFor(issues, unresolvedCode) ? (
          <p className="mt-2 text-sm text-rose-700">{issueText[unresolvedCode]}</p>
        ) : null}
      </fieldset>
      {showAmount ? (
        <TextField
          id={`${name}-amount`}
          className="mt-3"
          label={labels.chargeAmount}
          value={amount}
          inputMode="decimal"
          error={issueFor(issues, amountCode)}
          errorMessage={issueText[amountCode]}
          onChange={(event) => onAmount(event.target.value)}
        />
      ) : null}
    </Card>
  );
}

export function ItemsStep({
  state,
  issues,
  result,
  previewUrl,
  dispatch,
  onUseSample,
}: {
  state: FlowState;
  issues: Issue[];
  result: SplitResult | null;
  previewUrl: string | null;
  dispatch: Dispatch<FlowAction>;
  onUseSample: () => void;
}) {
  const bill = state.bill;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{labels.itemsIntro}</p>
      {bill.simulated ? <Banner tone="amber">{labels.sampleBanner}</Banner> : null}
      {bill.source === "upload" ? <Banner tone="emerald">{labels.uploadBanner}</Banner> : null}
      {bill.source === "manual" ? <Banner tone="slate">{labels.manualBanner}</Banner> : null}
      {bill.simulated ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/sample-receipt.svg"
          alt={labels.sampleImageAlt}
          className="w-full max-w-xs rounded-xl border border-slate-200 bg-white"
        />
      ) : previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={labels.previewAlt} className="max-h-80 rounded-xl border border-slate-200" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onUseSample}>
          {labels.fillSampleItems}
        </Button>
        <Button variant="secondary" onClick={() => dispatch({ type: "clear-items" })}>
          {labels.clearItems}
        </Button>
      </div>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="merchant"
            label={labels.merchant}
            value={bill.merchant}
            maxLength={80}
            onChange={(event) => dispatch({ type: "update-bill", patch: { merchant: event.target.value } })}
          />
          <div>
            <label htmlFor="currency" className="mb-1 block text-sm font-medium text-slate-700">
              {labels.currency}
            </label>
            <select
              id="currency"
              value={bill.currency}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
              onChange={(event) =>
                dispatch({
                  type: "update-bill",
                  patch: { currency: event.target.value as BillCurrency },
                })
              }
            >
              <option value="">{labels.currency}</option>
              <option value="THB">THB</option>
              <option value="USD">USD</option>
            </select>
            {issueFor(issues, "currency") ? (
              <p className="mt-1 text-sm text-rose-700">{issueText.currency}</p>
            ) : null}
          </div>
        </div>
        {bill.currency === "USD" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField
              id="rate"
              label={labels.rate}
              value={bill.rate}
              inputMode="decimal"
              error={issueFor(issues, "rate")}
              errorMessage={issueText.rate}
              onChange={(event) => dispatch({ type: "update-bill", patch: { rate: event.target.value } })}
            />
            <TextField
              id="rate-date"
              label={labels.rateDate}
              type="date"
              value={bill.rateDate}
              error={issueFor(issues, "rate-date")}
              errorMessage={issueText["rate-date"]}
              onChange={(event) => dispatch({ type: "update-bill", patch: { rateDate: event.target.value } })}
            />
            <p className="text-sm text-slate-500 sm:col-span-2">{labels.rateHelp}</p>
          </div>
        ) : null}
      </Card>

      <ul className="space-y-3">
        {bill.items.map((item, index) => (
          <li key={item.id}>
            <Card>
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem]">
                <TextField
                  id={`item-name-${item.id}`}
                  label={`${labels.itemName} ${index + 1}`}
                  value={item.name}
                  maxLength={80}
                  error={issueFor(issues, "item-name", item.id)}
                  errorMessage={issueText["item-name"]}
                  onChange={(event) =>
                    dispatch({ type: "update-item", id: item.id, patch: { name: event.target.value } })
                  }
                />
                <TextField
                  id={`item-qty-${item.id}`}
                  label={labels.quantity}
                  value={item.quantity}
                  inputMode="numeric"
                  maxLength={3}
                  error={issueFor(issues, "item-quantity", item.id)}
                  errorMessage={issueText["item-quantity"]}
                  onChange={(event) =>
                    dispatch({ type: "update-item", id: item.id, patch: { quantity: event.target.value } })
                  }
                />
                <TextField
                  id={`item-price-${item.id}`}
                  label={labels.unitPrice}
                  value={item.unitPrice}
                  inputMode="decimal"
                  error={issueFor(issues, "item-price", item.id)}
                  errorMessage={issueText["item-price"]}
                  onChange={(event) =>
                    dispatch({ type: "update-item", id: item.id, patch: { unitPrice: event.target.value } })
                  }
                />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {labels.lineTotal}: {lineAmount(item)} {bill.currency === "USD" ? labels.usdCode : labels.baht}
              </p>
              {item.assumptions.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                  {item.assumptions.map((flag) => (
                    <li key={flag}>
                      {labels.assumptions}: {flagLabel(flag)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.unresolved.length > 0 ? (
                <div className="mt-2 text-sm text-rose-700">
                  <p>{labels.unresolved}</p>
                  <ul className="list-disc pl-5">
                    {item.unresolved.map((flag) => (
                      <li key={flag}>{flagLabel(flag)}</li>
                    ))}
                  </ul>
                  <p>{labels.editClearsFlags}</p>
                </div>
              ) : null}
              <Button
                variant="danger"
                className="mt-3"
                onClick={() => dispatch({ type: "remove-item", id: item.id })}
              >
                {labels.removeItem}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        disabled={bill.items.length >= MAX_ITEMS}
        onClick={() => dispatch({ type: "add-item", id: crypto.randomUUID() })}
      >
        {labels.addItem}
      </Button>

      <ChargeFields
        title={labels.vat}
        treatment={bill.vatTreatment}
        amount={bill.vatAmount}
        issues={issues}
        unresolvedCode="vat-unresolved"
        amountCode="vat-amount"
        onTreatment={(vatTreatment) => dispatch({ type: "update-bill", patch: { vatTreatment } })}
        onAmount={(vatAmount) => dispatch({ type: "update-bill", patch: { vatAmount } })}
      />
      <ChargeFields
        title={labels.service}
        treatment={bill.serviceTreatment}
        amount={bill.serviceAmount}
        issues={issues}
        unresolvedCode="service-unresolved"
        amountCode="service-amount"
        onTreatment={(serviceTreatment) => dispatch({ type: "update-bill", patch: { serviceTreatment } })}
        onAmount={(serviceAmount) => dispatch({ type: "update-bill", patch: { serviceAmount } })}
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="printed-subtotal"
            label={labels.printedSubtotal}
            value={bill.printedSubtotal}
            inputMode="decimal"
            error={bill.printedSubtotal.trim() !== "" && parseMinor(bill.printedSubtotal, MAX_TOTAL_MINOR) === null}
            errorMessage={issueText["printed-amount"]}
            onChange={(event) =>
              dispatch({ type: "update-bill", patch: { printedSubtotal: event.target.value } })
            }
          />
          <TextField
            id="printed-total"
            label={labels.printedTotal}
            value={bill.printedTotal}
            inputMode="decimal"
            error={bill.printedTotal.trim() !== "" && parseMinor(bill.printedTotal, MAX_TOTAL_MINOR) === null}
            errorMessage={issueText["printed-amount"]}
            onChange={(event) => dispatch({ type: "update-bill", patch: { printedTotal: event.target.value } })}
          />
        </div>
        <p className="mt-2 text-sm text-slate-500">{labels.printedHelp}</p>
      </Card>

      {bill.warnings.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{labels.warnings}</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {bill.warnings.map((warning) => (
              <li key={warning}>{flagLabel(warning)}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <Totals bill={bill} result={result} />
        </Card>
      ) : null}
    </div>
  );
}

type BillCurrency = "" | "THB" | "USD";
