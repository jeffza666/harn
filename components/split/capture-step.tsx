import { buttonClass, Button, Banner } from "@/components/split/ui";
import { labels, prepareErrorText, extractErrorText } from "@/lib/labels";
import type { ExtractErrorCode, PrepareErrorCode } from "@/lib/types";

export type ReadyImage = { file: File; url: string; bytes: number };

function messageForExtract(code: string): string {
  return code in extractErrorText ? extractErrorText[code as ExtractErrorCode] : extractErrorText.provider;
}

export function CaptureStep({
  extraction,
  simulated,
  image,
  preparing,
  progress,
  prepareError,
  extractError,
  extracting,
  noticeAccepted,
  confirmReplace,
  onFile,
  onCancelImage,
  onSample,
  onManual,
  onToggleNotice,
  onExtract,
  onConfirmReplace,
  onKeepItems,
}: {
  extraction: { configured: boolean; modelSupported: boolean; model: string | null };
  simulated: boolean;
  image: ReadyImage | null;
  preparing: boolean;
  progress: number;
  prepareError: PrepareErrorCode | null;
  extractError: string | null;
  extracting: boolean;
  noticeAccepted: boolean;
  confirmReplace: boolean;
  onFile: (file: File) => void;
  onCancelImage: () => void;
  onSample: () => void;
  onManual: () => void;
  onToggleNotice: (value: boolean) => void;
  onExtract: () => void;
  onConfirmReplace: () => void;
  onKeepItems: () => void;
}) {
  const canExtract =
    image !== null &&
    !preparing &&
    !extracting &&
    extraction.configured &&
    extraction.modelSupported &&
    noticeAccepted;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{labels.captureIntro}</p>
      <p className="text-sm text-slate-500">{labels.acceptedFiles}</p>
      {simulated ? <Banner tone="amber">{labels.sampleBanner}</Banner> : null}
      {!extraction.configured ? <Banner tone="slate">{labels.noKey}</Banner> : null}
      {extraction.configured && !extraction.modelSupported ? <Banner tone="amber">{labels.badModel}</Banner> : null}
      {extraction.configured && extraction.modelSupported ? (
        <Banner tone="slate">
          {labels.providerNotice}
          {extraction.model ? ` ${labels.modelUsed}: ${extraction.model}` : ""}
        </Banner>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className={`${buttonClass("secondary")} cursor-pointer`}>
          {labels.upload}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
        <label className={`${buttonClass("secondary")} cursor-pointer`}>
          {labels.takePhoto}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
        <Button variant="secondary" onClick={onSample}>
          {labels.useSample}
        </Button>
        <Button variant="secondary" onClick={onManual}>
          {labels.enterManually}
        </Button>
      </div>

      {preparing ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={labels.progressLabel}
        >
          <p className="text-sm text-slate-600">
            {labels.compressing} {progress}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-emerald-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {prepareError ? (
        <p role="alert" className="text-sm text-rose-700">
          {prepareErrorText[prepareError]}
        </p>
      ) : null}

      {image ? (
        <div className="space-y-3">
          {/* Blob previews are created in the browser and are not a next/image source. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={labels.previewAlt} className="max-h-80 rounded-xl border border-slate-200" />
          <p className="text-sm text-slate-600">
            {labels.outputSize}: {(image.bytes / 1024 / 1024).toFixed(2)} MB
          </p>
          <Button variant="danger" onClick={onCancelImage}>
            {labels.cancelImage}
          </Button>
          {extraction.configured && extraction.modelSupported ? (
            <label className="flex items-start gap-2 text-sm leading-6 text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={noticeAccepted}
                onChange={(event) => onToggleNotice(event.target.checked)}
              />
              {labels.providerCheckbox}
            </label>
          ) : null}
          {confirmReplace ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">{labels.replaceTitle}</p>
              <p className="mt-1 text-sm leading-6 text-amber-950">{labels.replaceBody}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={onConfirmReplace} disabled={extracting}>
                  {extracting ? labels.extracting : labels.replaceConfirm}
                </Button>
                <Button variant="secondary" onClick={onKeepItems}>
                  {labels.replaceCancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={onExtract} disabled={!canExtract}>
              {extracting ? labels.extracting : labels.extract}
            </Button>
          )}
        </div>
      ) : null}

      {extractError ? (
        <p role="alert" className="text-sm text-rose-700">
          {messageForExtract(extractError)}
        </p>
      ) : null}
    </div>
  );
}
