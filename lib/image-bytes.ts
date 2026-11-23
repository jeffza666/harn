import { MAX_UPLOAD_BYTES } from "./source-file";

const MAX_EDGE = 8_000;
const MAX_PIXELS = 20_000_000;

export type InspectedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
};

export type InspectFailure = "invalid_image" | "unsupported_type" | "heic" | "too_large";

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset + length > bytes.length) return "";
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(bytes[offset + index]);
  }
  return text;
}

export function detectImageKind(bytes: Uint8Array): "jpeg" | "png" | "webp" | "heic" | "unknown" {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand.startsWith("hei") || brand === "mif1" || brand === "msf1") return "heic";
  }
  return "unknown";
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) {
      offset += 1;
      if (offset >= bytes.length) return null;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (length < 7 || offset + 6 >= bytes.length) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }
    offset += length;
  }
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (chunk === "VP8 ") {
    const end = Math.min(bytes.length - 7, 84);
    for (let index = 20; index < end; index += 1) {
      if (bytes[index] === 0x9d && bytes[index + 1] === 0x01 && bytes[index + 2] === 0x2a) {
        return {
          width: (bytes[index + 3] | (bytes[index + 4] << 8)) & 0x3fff,
          height: (bytes[index + 5] | (bytes[index + 6] << 8)) & 0x3fff,
        };
      }
    }
    return null;
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function withinBounds(size: { width: number; height: number }): boolean {
  if (size.width < 1 || size.height < 1) return false;
  if (size.width > MAX_EDGE || size.height > MAX_EDGE) return false;
  if (size.width * size.height > MAX_PIXELS) return false;
  return true;
}

export function normalizeMime(type: string): "image/jpeg" | "image/png" | "image/webp" | null {
  const value = type.toLowerCase();
  if (value === "image/jpg" || value === "image/jpeg") return "image/jpeg";
  if (value === "image/png") return "image/png";
  if (value === "image/webp") return "image/webp";
  return null;
}

export function inspectImage(
  bytes: Uint8Array,
  declaredType: string,
): { ok: true; image: InspectedImage } | { ok: false; code: InspectFailure } {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "too_large" };
  }
  const kind = detectImageKind(bytes);
  if (kind === "heic") return { ok: false, code: "heic" };
  if (kind === "unknown") return { ok: false, code: "invalid_image" };
  const declared = normalizeMime(declaredType);
  const actual = kind === "jpeg" ? "image/jpeg" : kind === "png" ? "image/png" : "image/webp";
  if (!declared || declared !== actual) return { ok: false, code: "unsupported_type" };
  const size = kind === "jpeg" ? jpegSize(bytes) : kind === "png" ? pngSize(bytes) : webpSize(bytes);
  if (!size || !withinBounds(size)) return { ok: false, code: "invalid_image" };
  return { ok: true, image: { mime: actual, width: size.width, height: size.height } };
}
