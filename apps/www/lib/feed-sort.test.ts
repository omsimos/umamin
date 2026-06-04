import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_SORT, FEED_SORTS, normalizeFeedSort } from "./feed-sort";

describe("normalizeFeedSort", () => {
  it("passes through the explicit non-default sorts", () => {
    expect(normalizeFeedSort("following")).toBe("following");
    expect(normalizeFeedSort("latest")).toBe("latest");
  });

  it("keeps `hot` as the default", () => {
    expect(normalizeFeedSort("hot")).toBe("hot");
    expect(DEFAULT_FEED_SORT).toBe("hot");
  });

  it("falls back to the default for unknown / empty / nullish values", () => {
    for (const value of ["", "trending", "HOT", null, undefined]) {
      expect(normalizeFeedSort(value)).toBe(DEFAULT_FEED_SORT);
    }
  });

  it("exposes the canonical sort list", () => {
    expect(FEED_SORTS).toEqual(["hot", "following", "latest"]);
  });
});
