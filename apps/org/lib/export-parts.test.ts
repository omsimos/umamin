import { describe, expect, it } from "vitest";
import { splitIntoParts, zipPartName } from "./export-parts";

describe("splitIntoParts", () => {
  it("splits into parts of the given size, last part shorter", () => {
    expect(splitIntoParts([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitIntoParts([], 2)).toEqual([]);
  });
});

describe("zipPartName", () => {
  it("keeps the single-file name for a one-part export", () => {
    expect(zipPartName("acme", 0, 1)).toBe("acme-messages.zip");
  });

  it("numbers each part of a multi-part export", () => {
    expect(zipPartName("acme", 1, 12)).toBe("acme-messages-part-02-of-12.zip");
  });
});
