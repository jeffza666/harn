import { geminiApiKey, geminiModel, isSupportedFlashModel } from "@/lib/env";
import { requestExtraction } from "@/lib/gemini";
import { inspectImage } from "@/lib/image-bytes";
import { clientAddress, createRateLimiter } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES } from "@/lib/source-file";
import type { ExtractErrorCode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const limiter = createRateLimiter(8, 60_000);

const statusFor: Record<ExtractErrorCode, number> = {
  not_configured: 503,
  bad_model: 400,
  rate_limited: 429,
  invalid_image: 400,
  unsupported_type: 415,
  heic: 415,
  too_large: 413,
  quota: 429,
  timeout: 504,
  provider: 502,
  malformed: 502,
  refused: 422,
  auth: 502,
};

function errorResponse(code: ExtractErrorCode) {
  return Response.json(
    { ok: false, code },
    { status: statusFor[code], headers: { "cache-control": "no-store" } },
  );
}

export function GET() {
  const configured = geminiApiKey() !== undefined;
  const model = configured ? geminiModel() : null;
  return Response.json(
    {
      configured,
      model,
      modelSupported: model !== null && isSupportedFlashModel(model),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!limiter.allow(clientAddress(request))) return errorResponse("rate_limited");
  const apiKey = geminiApiKey();
  if (!apiKey) return errorResponse("not_configured");
  const model = geminiModel();
  if (!isSupportedFlashModel(model)) return errorResponse("bad_model");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("invalid_image");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return errorResponse("invalid_image");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return errorResponse("too_large");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectImage(bytes, file.type);
  if (!inspected.ok) return errorResponse(inspected.code);

  const result = await requestExtraction({
    image: bytes,
    mimeType: inspected.image.mime,
    apiKey,
    model,
  });
  if (!result.ok) return errorResponse(result.code);
  return Response.json(
    { ok: true, draft: result.draft },
    { headers: { "cache-control": "no-store" } },
  );
}
