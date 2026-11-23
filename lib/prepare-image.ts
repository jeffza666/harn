import { classifySourceFile, MAX_UPLOAD_BYTES } from "./source-file";
import type { PrepareErrorCode } from "./types";

type PrepareResult =
  | { ok: true; file: File }
  | { ok: false; code: PrepareErrorCode | "cancelled" };

/**
 * Re-encode through canvas so EXIF is dropped and orientation is applied by the browser.
 * HEIC is rejected before this runs; the bytes are never renamed to JPEG.
 */
export async function prepareReceiptImage(
  file: File,
  options: { signal: AbortSignal; onProgress: (percent: number) => void },
): Promise<PrepareResult> {
  const kind = classifySourceFile(file);
  if (kind !== "ok") return { ok: false, code: kind };
  if (options.signal.aborted) return { ok: false, code: "cancelled" };

  try {
    const decoded = await createImageBitmap(file);
    decoded.close();
  } catch {
    return { ok: false, code: options.signal.aborted ? "cancelled" : "decode" };
  }

  try {
    const imageCompression = (await import("browser-image-compression")).default;
    const compress = (maxSizeMB: number, maxWidthOrHeight: number, initialQuality: number) =>
      imageCompression(file, {
        maxSizeMB,
        maxWidthOrHeight,
        useWebWorker: false,
        fileType: "image/jpeg",
        initialQuality,
        preserveExif: false,
        signal: options.signal,
        onProgress: options.onProgress,
      });

    let compressed = await compress(2, 2560, 0.82);
    if (compressed.size > MAX_UPLOAD_BYTES) {
      compressed = await compress(1.5, 1920, 0.7);
    }
    if (options.signal.aborted) return { ok: false, code: "cancelled" };
    if (compressed.size > MAX_UPLOAD_BYTES) return { ok: false, code: "too-large-output" };

    const check = await createImageBitmap(compressed);
    const readable = check.width > 0 && check.height > 0;
    check.close();
    if (!readable) return { ok: false, code: "decode" };

    return {
      ok: true,
      file: new File([compressed], "receipt.jpg", { type: "image/jpeg", lastModified: Date.now() }),
    };
  } catch {
    return { ok: false, code: options.signal.aborted ? "cancelled" : "decode" };
  }
}
