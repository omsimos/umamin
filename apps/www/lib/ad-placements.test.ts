import { describe, expect, it } from "vitest";
import { adPlacements } from "./ad-placements";

const EXPECTED_KEYS = [
  "feed_top",
  "feed_inline",
  "notes_top",
  "notes_inline",
  "profile_bottom",
  "post_detail",
] as const;

// Only profile_bottom is below the fold; everything else is above-the-fold.
const LAZY_KEY = "profile_bottom";

describe("adPlacements", () => {
  it("exposes exactly the expected keys", () => {
    expect(Object.keys(adPlacements).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it.each(EXPECTED_KEYS)("%s has a well-typed entry", (key) => {
    const entry = adPlacements[key];
    expect(typeof entry.slotId).toBe("string");
    expect(entry.slotId).toMatch(/^\d+$/);
    expect(typeof entry.minHeight).toBe("number");
    expect(Number.isFinite(entry.minHeight)).toBe(true);
    expect(typeof entry.lazy).toBe("boolean");
  });

  it("lazy-loads only profile_bottom", () => {
    for (const key of EXPECTED_KEYS) {
      expect(adPlacements[key].lazy).toBe(key === LAZY_KEY);
    }
  });

  it("eagerly loads every above-the-fold placement", () => {
    for (const key of EXPECTED_KEYS) {
      if (key !== LAZY_KEY) {
        expect(adPlacements[key].lazy).toBe(false);
      }
    }
  });
});
