export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export type SourceKind = "ok" | "heic" | "too-large" | "unsupported" | "empty";

export function classifySourceFile(file: { type: string; name: string; size: number }): SourceKind {
  if (file.size <= 0) return "empty";
  if (file.size > MAX_SOURCE_BYTES) return "too-large";
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "heic";
  }
  if (ALLOWED_TYPES.has(type) || ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "ok";
  }
  return "unsupported";
}
