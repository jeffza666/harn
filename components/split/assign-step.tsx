import type { Dispatch } from "react";
import { Totals } from "@/components/split/totals";
import { Card, issueFor, TextField } from "@/components/split/ui";
import type { FlowAction, FlowState } from "@/lib/flow";
import { flagLabel, issueText, labels } from "@/lib/labels";
import { formatMinor } from "@/lib/money";
import type { SplitResult } from "@/lib/split";
import type { ChargeAllocation, Issue } from "@/lib/types";

function Allocation({
  legend,
  name,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  value: ChargeAllocation;
  onChange: (value: ChargeAllocation) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-900">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-4">
        {(["equal", "proportional"] as const).map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-slate-800">
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            {option === "equal" ? labels.allocationEqual : labels.allocationProportional}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AssignStep({
  state,
  issues,
  result,
  dispatch,
}: {
  state: FlowState;
  issues: Issue[];
  result: SplitResult | null;
  dispatch: Dispatch<FlowAction>;
}) {
  const mismatch = Boolean(result?.subtotalMismatch || result?.totalMismatch);
  const needsAck = state.bill.warnings.length > 0 || mismatch;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{labels.assignIntro}</p>
      {state.bill.vatTreatment === "added" ? (
        <Card>
          <Allocation
            legend={labels.allocationVat}
            name="vat-allocation"
            value={state.bill.vatAllocation}
            onChange={(vatAllocation) => dispatch({ type: "update-bill", patch: { vatAllocation } })}
          />
        </Card>
      ) : null}
      {state.bill.serviceTreatment === "added" ? (
        <Card>
          <Allocation
            legend={labels.allocationService}
            name="service-allocation"
            value={state.bill.serviceAllocation}
            onChange={(serviceAllocation) => dispatch({ type: "update-bill", patch: { serviceAllocation } })}
          />
        </Card>
      ) : null}
      <ul className="space-y-3">
        {state.bill.items.map((item) => {
          const line = result?.itemLines.find((entry) => entry.itemId === item.id);
          return (
            <li key={item.id}>
              <Card>
                <h2 className="font-semibold text-slate-900">{item.name || labels.itemName}</h2>
                <fieldset className="mt-3">
                  <legend className="text-sm font-medium text-slate-700">{labels.participants}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {state.participants.map((person) => {
                      const checked = item.participantIds.includes(person.id);
                      return (
                        <label
                          key={person.id}
                          className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const participantIds = checked
                                ? item.participantIds.filter((id) => id !== person.id)
                                : [...item.participantIds, person.id];
                              dispatch({ type: "update-item", id: item.id, patch: { participantIds } });
                            }}
                          />
                          {person.name}
                        </label>
                      );
                    })}
                  </div>
                  {issueFor(issues, "item-participants", item.id) ? (
                    <p className="mt-2 text-sm text-rose-700">{issueText["item-participants"]}</p>
                  ) : null}
                </fieldset>
                <fieldset className="mt-3">
                  <legend className="sr-only">{item.name || labels.itemName}</legend>
                  <div className="flex flex-wrap gap-4">
                    {(["equal", "weighted"] as const).map((mode) => (
                      <label key={mode} className="flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="radio"
                          name={`split-${item.id}`}
                          checked={item.splitMode === mode}
                          onChange={() => dispatch({ type: "update-item", id: item.id, patch: { splitMode: mode } })}
                        />
                        {mode === "equal" ? labels.splitEqual : labels.splitWeighted}
                      </label>
                    ))}
                  </div>
                  {issueFor(issues, "item-weights", item.id) ? (
                    <p className="mt-2 text-sm text-rose-700">{issueText["item-weights"]}</p>
                  ) : null}
                </fieldset>
                {line ? (
                  <p className="mt-3 text-sm text-slate-600">
                    {labels.perItem}:{" "}
                    {line.shares
                      .map((share) => {
                        const name = state.participants.find((person) => person.id === share.participantId)?.name;
                        return `${name} ${formatMinor(share.minor)}`;
                      })
                      .join(" · ")}
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
      {result ? (
        <Card>
          <Totals bill={state.bill} result={result} />
        </Card>
      ) : null}
      {needsAck ? (
        <Card>
          {state.bill.warnings.length > 0 ? (
            <ul className="mb-3 list-disc pl-5 text-sm text-slate-700">
              {state.bill.warnings.map((warning) => (
                <li key={warning}>{flagLabel(warning)}</li>
              ))}
            </ul>
          ) : null}
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={state.bill.acknowledged}
              onChange={(event) => dispatch({ type: "acknowledge", value: event.target.checked })}
            />
            {labels.ackLabel}
          </label>
          {mismatch ? (
            <TextField
              id="discrepancy-note"
              className="mt-3"
              label={labels.ackNote}
              value={state.bill.discrepancyNote}
              maxLength={300}
              error={issueFor(issues, "discrepancy")}
              errorMessage={issueText.discrepancy}
              onChange={(event) => dispatch({ type: "set-note", note: event.target.value })}
            />
          ) : null}
          {!mismatch && issueFor(issues, "acknowledgement") ? (
            <p className="mt-2 text-sm text-rose-700">{issueText.acknowledgement}</p>
          ) : null}
          <p className="mt-2 text-sm text-slate-500">{labels.ackNoteHelp}</p>
        </Card>
      ) : null}
    </div>
  );
}
