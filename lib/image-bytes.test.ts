import { describe, expect, it } from "vitest";
import { inspectImage } from "./image-bytes";
import { classifySourceFile } from "./source-file";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("inspectImage", () => {
  it("reads a PNG header and rejects a mismatched mime", () => {
    const ok = inspectImage(png, "image/png");
    expect(ok).toEqual({ ok: true, image: { mime: "image/png", width: 1, height: 1 } });
    expect(inspectImage(png, "image/jpeg").ok).toBe(false);
  });

  it("reads a JPEG start-of-frame and a WebP VP8X header", () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x02, 0x01, 0x11, 0x00, 0x00,
    ]);
    expect(inspectImage(jpeg, "image/jpg")).toEqual({
      ok: true,
      image: { mime: "image/jpeg", width: 2, height: 2 },
    });

    const webp = new Uint8Array(30);
    webp.set(Buffer.from("RIFF"), 0);
    webp[4] = 22;
    webp.set(Buffer.from("WEBPVP8X"), 8);
    webp[24] = 9;
    webp[27] = 4;
    expect(inspectImage(webp, "image/webp")).toEqual({
      ok: true,
      image: { mime: "image/webp", width: 10, height: 5 },
    });
  });

  it("does not rename HEIC bytes", () => {
    const heic = new Uint8Array(12);
    heic.set(Buffer.from("ftypheic"), 4);
    expect(inspectImage(heic, "image/jpeg")).toEqual({ ok: false, code: "heic" });
  });
});

describe("classifySourceFile", () => {
  it("separates HEIC, oversized files, and supported types", () => {
    expect(classifySourceFile({ name: "receipt.heic", type: "", size: 10 })).toBe("heic");
    expect(classifySourceFile({ name: "a.jpg", type: "image/jpeg", size: 21 * 1024 * 1024 })).toBe("too-large");
    expect(classifySourceFile({ name: "a.jpg", type: "", size: 100 })).toBe("ok");
    expect(classifySourceFile({ name: "a.gif", type: "image/gif", size: 100 })).toBe("unsupported");
    expect(classifySourceFile({ name: "a.jpg", type: "image/jpeg", size: 0 })).toBe("empty");
  });
});
