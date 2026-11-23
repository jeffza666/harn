import { useEffect, useRef, useState } from "react";
import { Totals } from "@/components/split/totals";
import { Button, Card } from "@/components/split/ui";
import type { FlowState } from "@/lib/flow";
import { labels } from "@/lib/labels";
import { formatMinor } from "@/lib/money";
import type { SplitResult } from "@/lib/split";
import { buildSummary } from "@/lib/summary";

export function SummaryStep({ state, result }: { state: FlowState; result: SplitResult | null }) {
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);
  const text = result ? buildSummary(state.bill, state.participants, state.payerId, result) : "";
  const names = new Map(state.participants.map((person) => [person.id, person.name.trim()]));
  const payerName = names.get(state.payerId) ?? "";

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!result) {
    return <p className="text-sm text-slate-600">{labels.fixBeforeContinue}</p>;
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      areaRef.current?.focus();
      areaRef.current?.select();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{labels.summaryIntro}</p>
      {state.bill.simulated ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">{labels.simulatedBadge}</p>
      ) : (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {state.bill.source === "upload" ? labels.realBadge : labels.manualBadge}
        </p>
      )}
      <Card>
        {state.bill.merchant ? <p className="font-semibold text-slate-900">{state.bill.merchant}</p> : null}
        <p className="mt-1 text-sm text-slate-600">
          {labels.payer}: {payerName}
        </p>
        <div className="mt-4">
          <Totals bill={state.bill} result={result} />
        </div>
      </Card>
      <ul className="space-y-3">
        {result.shares.map((share) => {
          const name = names.get(share.participantId) ?? share.participantId;
          const isPayer = share.participantId === state.payerId;
          return (
            <li key={share.participantId}>
              <Card>
                <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {labels.responsibility}: {formatMinor(share.thbMinor)} {labels.baht}
                </p>
                {isPayer ? (
                  <p className="mt-1 text-sm text-slate-800">
                    {labels.paidBy} {formatMinor(result.thbTotalMinor)} {labels.baht}
                    {" · "}
                    {labels.ownShare} {formatMinor(share.thbMinor)} {labels.baht}
                    {" · "}
                    {labels.receives} {formatMinor(result.thbTotalMinor - share.thbMinor)} {labels.baht}
                  </p>
                ) : share.thbMinor > 0 ? (
                  <p className="mt-1 text-sm font-semibold text-emerald-800">
                    {labels.owes} {payerName} {formatMinor(share.thbMinor)} {labels.baht}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">{labels.noShare}</p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{labels.copyLabel}</h2>
          <Button aria-live="polite" onClick={() => void copySummary()}>
            {copied ? labels.copied : labels.copy}
          </Button>
        </div>
        <textarea
          ref={areaRef}
          readOnly
          value={text}
          aria-label={labels.copyLabel}
          className="mt-3 h-64 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-800"
        />
        <p className="mt-2 text-sm text-slate-500">{labels.transferNote}</p>
      </Card>
    </div>
  );
}
