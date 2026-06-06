import { describe, expect, it } from "vitest";
import { parseContentRangeTotal, sniffImageType } from "./r2";

describe("sniffImageType", () => {
  it("recognizes JPEG magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
  });

  it("recognizes WebP magic bytes (RIFF....WEBP)", () => {
    const bytes = new Uint8Array(16);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(sniffImageType(bytes)).toBe("image/webp");
  });

  it("rejects PNG, truncated, and arbitrary bytes", () => {
    // PNG signature — valid image, but not a format we store.
    expect(
      sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])),
    ).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array(16))).toBeNull();
  });
});

describe("parseContentRangeTotal", () => {
  it("parses the total from a range response", () => {
    expect(parseContentRangeTotal("bytes 0-15/123456")).toBe(123456);
  });

  it("rejects unknown or malformed totals", () => {
    expect(parseContentRangeTotal("bytes 0-15/*")).toBeNull();
    expect(parseContentRangeTotal("bytes 0-15")).toBeNull();
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal("bytes 0-15/abc")).toBeNull();
  });
});
