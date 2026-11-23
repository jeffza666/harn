import { parseProviderPayload } from "./extraction";
import type { ExtractedDraft, ExtractErrorCode } from "./types";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_RESPONSE_CHARS = 200_000;

const chargeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["treatment", "amount"],
  properties: {
    treatment: {
      type: "string",
      enum: ["included", "added", "none", "unresolved"],
      description: "included is already in item prices. added increases the total. none is absent. unresolved is unclear.",
    },
    amount: {
      type: ["string", "null"],
      description: 'Decimal string such as "7.00", or null when unreadable. Never use 0 for an unreadable amount.',
    },
  },
} as const;

export const receiptResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "currency", "items", "vat", "service", "printedSubtotal", "printedTotal", "warnings"],
  properties: {
    merchant: { type: ["string", "null"], description: "Shop or header name as printed, or null." },
    currency: {
      type: ["string", "null"],
      description: 'Use "THB" or "USD" only. Null when the currency is absent or not one of those two.',
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unitPrice", "lineTotal", "priceBasis", "unresolved"],
        properties: {
          name: { type: "string", description: "Item name as printed." },
          quantity: {
            type: "integer",
            description: "Positive integer quantity. Use 1 when only a line total is readable.",
          },
          unitPrice: { type: ["string", "null"], description: 'Unit price decimal string such as "120.00", or null.' },
          lineTotal: { type: ["string", "null"], description: "Line total decimal string, or null." },
          priceBasis: { type: "string", enum: ["unit", "line", "ambiguous"] },
          unresolved: { type: "array", items: { type: "string" } },
        },
      },
    },
    vat: chargeSchema,
    service: chargeSchema,
    printedSubtotal: { type: ["string", "null"], description: "Printed subtotal, or null." },
    printedTotal: { type: ["string", "null"], description: "Printed grand total, or null." },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Discounts, refunds, and unreadable regions.",
    },
  },
} as const;

const PROMPT = `Extract this one receipt into the required JSON for a bill-splitting review screen.
Read Thai and English. Copy names and figures as printed. Do not invent items, taxes, discounts, or totals.
Money fields are decimal strings with a dot and at most 2 fraction digits, such as "120.00". Use null when a number is not readable. Never write 0 for an unreadable amount.
priceBasis is "unit" when the unit price is readable, "line" when only the line total is readable, and "ambiguous" when those disagree or you cannot tell.
If only a line total is readable, set quantity to 1, priceBasis to "line", and put that total in lineTotal.
currency is "THB", "USD", or null. Do not guess any other currency.
vat and service treatment is "included" when the charge is already inside item prices, "added" when it increases the grand total, "none" when it is absent, and "unresolved" when the treatment or amount is unclear. Do not decide an unclear tax treatment.
printedSubtotal and printedTotal are the figures printed on the receipt, or null.
warnings lists discounts, refunds, and unreadable regions. Do not assign people to items.`;

export type ExtractionSuccess = { ok: true; draft: ExtractedDraft };
export type ExtractionFailure = { ok: false; code: ExtractErrorCode };

function readModelText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text;
  if (!Array.isArray(record.steps)) return null;
  const chunks: string[] = [];
  for (const step of record.steps) {
    if (!step || typeof step !== "object") continue;
    if ((step as { type?: unknown }).type !== "model_output") continue;
    const content = (step as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      if ((block as { type?: unknown }).type !== "text") continue;
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  const joined = chunks.join("");
  return joined.trim() ? joined : null;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("json");
  }
}

export function interpretProviderResponse(status: number, bodyText: string): ExtractionSuccess | ExtractionFailure {
  if (status === 401 || status === 403) return { ok: false, code: "auth" };
  if (status === 404) return { ok: false, code: "bad_model" };
  if (status === 408 || status === 504) return { ok: false, code: "timeout" };
  if (status === 413) return { ok: false, code: "too_large" };
  if (status === 429) return { ok: false, code: "quota" };
  if (status === 503) return { ok: false, code: "provider" };
  if (status < 200 || status >= 300) return { ok: false, code: "provider" };
  if (bodyText.length > MAX_RESPONSE_CHARS) return { ok: false, code: "malformed" };

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return { ok: false, code: "malformed" };
  }
  if (body && typeof body === "object") {
    const statusText = String((body as { status?: unknown }).status ?? "");
    if (statusText === "failed" || statusText === "cancelled") {
      const blob = bodyText.slice(0, 800).toLowerCase();
      if (blob.includes("safety") || blob.includes("block") || blob.includes("recitation")) {
        return { ok: false, code: "refused" };
      }
      return { ok: false, code: "provider" };
    }
  }
  const text = readModelText(body);
  if (!text) return { ok: false, code: "malformed" };
  try {
    const draft = parseProviderPayload(parseJsonObject(text));
    if (!draft) return { ok: false, code: "malformed" };
    return { ok: true, draft };
  } catch {
    return { ok: false, code: "malformed" };
  }
}

function isTimeout(error: unknown): boolean {
  return (
    (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) ||
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "TimeoutError")
  );
}

function retryable(result: ExtractionFailure): boolean {
  return result.code === "quota" || result.code === "provider" || result.code === "timeout";
}

export async function requestExtraction(input: {
  image: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ExtractionSuccess | ExtractionFailure> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const payload = {
    model: input.model,
    input: [
      { type: "text", text: PROMPT },
      {
        type: "image",
        data: Buffer.from(input.image).toString("base64"),
        mime_type: input.mimeType,
        resolution: "high",
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: receiptResponseSchema,
    },
    generation_config: { thinking_level: "low" },
  };

  let last: ExtractionFailure = { ok: false, code: "provider" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": input.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(input.timeoutMs ?? 25_000),
      });
      const result = interpretProviderResponse(response.status, await response.text());
      if (result.ok || !retryable(result) || attempt === 1) return result;
      last = result;
    } catch (error) {
      last = { ok: false, code: isTimeout(error) ? "timeout" : "provider" };
      if (attempt === 1) return last;
    }
  }
  return last;
}
