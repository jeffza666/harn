"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { AssignStep } from "@/components/split/assign-step";
import { CaptureStep, type ReadyImage } from "@/components/split/capture-step";
import { ItemsStep } from "@/components/split/items-step";
import { PeopleStep } from "@/components/split/people-step";
import { SummaryStep } from "@/components/split/summary-step";
import { Button, IssueList } from "@/components/split/ui";
import { createFlowState, flowReducer } from "@/lib/flow";
import { isExtractedDraft } from "@/lib/extraction";
import { labels } from "@/lib/labels";
import { prepareReceiptImage } from "@/lib/prepare-image";
import { evaluateBill, issuesForStep } from "@/lib/split";
import type { PrepareErrorCode, Step } from "@/lib/types";

const steps: Step[] = ["people", "capture", "items", "assign", "summary"];

export function SplitApp({
  initialDemo,
  extraction,
}: {
  initialDemo: boolean;
  extraction: { configured: boolean; modelSupported: boolean; model: string | null };
}) {
  const [state, dispatch] = useReducer(flowReducer, initialDemo, createFlowState);
  const [image, setImage] = useState<ReadyImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prepareError, setPrepareError] = useState<PrepareErrorCode | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const imageUrl = useRef<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    };
  }, []);

  const evaluation = evaluateBill(state.bill, state.participants, state.payerId);

  function ready(step: Step): boolean {
    if (step === "people") return issuesForStep("people", evaluation.issues).length === 0;
    if (step === "capture") return state.bill.source !== null;
    if (step === "items") return issuesForStep("items", evaluation.issues).length === 0;
    if (step === "assign") return issuesForStep("assign", evaluation.issues).length === 0;
    return evaluation.issues.length === 0 && evaluation.result !== null;
  }

  function canEnter(target: Step): boolean {
    const index = steps.indexOf(target);
    for (let cursor = 0; cursor < index; cursor += 1) {
      if (!ready(steps[cursor])) return false;
    }
    return true;
  }

  function replaceImage(next: ReadyImage | null) {
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = next?.url ?? null;
    setImage(next);
  }

  function forgetImage() {
    requestId.current += 1;
    abortRef.current?.abort();
    setPreparing(false);
    setPrepareError(null);
    setConfirmReplace(false);
    replaceImage(null);
  }

  async function onFile(file: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = requestId.current + 1;
    requestId.current = id;
    setPreparing(true);
    setProgress(0);
    setPrepareError(null);
    setExtractError(null);
    setConfirmReplace(false);
    const prepared = await prepareReceiptImage(file, {
      signal: controller.signal,
      onProgress: (value) => {
        if (requestId.current === id) setProgress(value);
      },
    });
    if (requestId.current !== id) return;
    setPreparing(false);
    if (!prepared.ok) {
      if (prepared.code !== "cancelled") {
        replaceImage(null);
        setPrepareError(prepared.code);
      }
      return;
    }
    replaceImage({
      file: prepared.file,
      url: URL.createObjectURL(prepared.file),
      bytes: prepared.file.size,
    });
  }

  async function runExtract() {
    if (!image) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const body = new FormData();
      body.set("image", image.file);
      const response = await fetch("/api/extract", { method: "POST", body });
      const payload: unknown = await response.json().catch(() => null);
      if (!payload || typeof payload !== "object" || !("ok" in payload)) {
        setExtractError("provider");
        return;
      }
      const record = payload as { ok: boolean; code?: string; draft?: unknown };
      if (!record.ok || !isExtractedDraft(record.draft)) {
        setExtractError(record.code ?? "malformed");
        return;
      }
      dispatch({
        type: "load-extracted",
        draft: record.draft,
        itemIds: record.draft.items.map(() => crypto.randomUUID()),
      });
      setConfirmReplace(false);
    } catch {
      setExtractError("provider");
    } finally {
      setExtracting(false);
    }
  }

  const stepIssues =
    state.step === "people" || state.step === "items" || state.step === "assign"
      ? issuesForStep(state.step, evaluation.issues)
      : [];
  const next = steps[steps.indexOf(state.step) + 1];
  const previous = steps[steps.indexOf(state.step) - 1];

  return (
    <main className="flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">{labels.appName}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{labels.splitTitle}</h1>
          </div>
          <Link href="/" className="text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline">
            {labels.backHome}
          </Link>
        </header>
        <p className="mt-3 text-sm text-slate-500">{labels.browserOnly}</p>
        <nav aria-label={labels.stepList} className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {steps.map((step) => {
            const current = state.step === step;
            return (
              <button
                key={step}
                type="button"
                aria-current={current ? "step" : undefined}
                disabled={!current && !canEnter(step)}
                onClick={() => dispatch({ type: "set-step", step })}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
                  current ? "bg-emerald-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {labels.steps[step]}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 space-y-4">
          <IssueList issues={stepIssues} />
          {state.step === "people" ? <PeopleStep state={state} issues={stepIssues} dispatch={dispatch} /> : null}
          {state.step === "capture" ? (
            <CaptureStep
              extraction={extraction}
              simulated={state.bill.simulated}
              image={image}
              preparing={preparing}
              progress={progress}
              prepareError={prepareError}
              extractError={extractError}
              extracting={extracting}
              noticeAccepted={noticeAccepted}
              confirmReplace={confirmReplace}
              onFile={(file) => void onFile(file)}
              onCancelImage={forgetImage}
              onSample={() => {
                forgetImage();
                dispatch({ type: "load-sample" });
              }}
              onManual={() => {
                forgetImage();
                dispatch({ type: "load-manual", itemId: crypto.randomUUID() });
              }}
              onToggleNotice={setNoticeAccepted}
              onExtract={() => {
                if (state.bill.items.length > 0) setConfirmReplace(true);
                else void runExtract();
              }}
              onConfirmReplace={() => void runExtract()}
              onKeepItems={() => setConfirmReplace(false)}
            />
          ) : null}
          {state.step === "items" ? (
            <ItemsStep
              state={state}
              issues={stepIssues}
              result={evaluation.result}
              previewUrl={image?.url ?? null}
              dispatch={dispatch}
              onUseSample={() => {
                forgetImage();
                dispatch({ type: "load-sample" });
              }}
            />
          ) : null}
          {state.step === "assign" ? (
            <AssignStep state={state} issues={stepIssues} result={evaluation.result} dispatch={dispatch} />
          ) : null}
          {state.step === "summary" ? <SummaryStep state={state} result={evaluation.result} /> : null}
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <Button
            variant="secondary"
            disabled={!previous}
            onClick={() => previous && dispatch({ type: "set-step", step: previous })}
          >
            {labels.back}
          </Button>
          <Button disabled={!next || !canEnter(next)} onClick={() => next && dispatch({ type: "set-step", step: next })}>
            {labels.next}
          </Button>
        </div>
      </div>
    </main>
  );
}
