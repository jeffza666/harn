import { Button, Card, issueFor, TextField } from "@/components/split/ui";
import { MAX_PARTICIPANTS, type FlowAction, type FlowState } from "@/lib/flow";
import { issueText, labels } from "@/lib/labels";
import type { Issue } from "@/lib/types";
import type { Dispatch } from "react";

export function PeopleStep({
  state,
  issues,
  dispatch,
}: {
  state: FlowState;
  issues: Issue[];
  dispatch: Dispatch<FlowAction>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{labels.peopleIntro}</p>
      <p className="text-sm text-slate-500">{labels.weightHelp}</p>
      <ul className="space-y-3">
        {state.participants.map((person, index) => {
          const nameError = issueFor(issues, "participant-name", person.id);
          const weightError = issueFor(issues, "participant-weight", person.id);
          return (
            <li key={person.id}>
              <Card>
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]">
                  <TextField
                    id={`name-${person.id}`}
                    label={`${labels.personName} ${index + 1}`}
                    value={person.name}
                    error={nameError}
                    errorMessage={issueText["participant-name"]}
                    maxLength={40}
                    onChange={(event) =>
                      dispatch({ type: "update-participant", id: person.id, name: event.target.value })
                    }
                  />
                  <TextField
                    id={`weight-${person.id}`}
                    label={labels.weight}
                    value={person.weight}
                    error={weightError}
                    errorMessage={issueText["participant-weight"]}
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) =>
                      dispatch({ type: "update-participant", id: person.id, weight: event.target.value })
                    }
                  />
                  <div className="flex items-end gap-3 pb-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <input
                        type="radio"
                        name="payer"
                        checked={state.payerId === person.id}
                        onChange={() => dispatch({ type: "set-payer", id: person.id })}
                      />
                      {labels.selectPayer}
                    </label>
                    <Button
                      variant="danger"
                      disabled={state.participants.length <= 1}
                      onClick={() => dispatch({ type: "remove-participant", id: person.id })}
                    >
                      {labels.removePerson}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        disabled={state.participants.length >= MAX_PARTICIPANTS}
        onClick={() => dispatch({ type: "add-participant", id: crypto.randomUUID() })}
      >
        {labels.addPerson}
      </Button>
    </div>
  );
}
