export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/** Dynamic lookup so Next does not inline the key at build time. */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function geminiApiKey(): string | undefined {
  return readEnv("GEMINI_API_KEY");
}

export function geminiModel(): string {
  return readEnv("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL;
}

/**
 * Receipt extraction needs a Flash-family vision model.
 * Image-generation, preview, and retired 1.5 / 2.0 ids are rejected.
 */
export function isSupportedFlashModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  if (!id.startsWith("gemini") || !id.includes("flash")) return false;
  if (
    id.includes("image") ||
    id.includes("imagen") ||
    id.includes("banana") ||
    id.includes("tts") ||
    id.includes("audio") ||
    id.includes("live")
  ) {
    return false;
  }
  if (id.includes("1.5") || id.includes("2.0") || id.includes("preview")) return false;
  return true;
}
