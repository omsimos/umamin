import { describe, expect, it } from "vitest";
import { adPlacements } from "./ad-placements";

const EXPECTED_KEYS = [
  "feed_top",
  "feed_inline",
  "notes_top",
  "notes_inline",
  "profile_bottom",
  "post_detail",
  "to_user",
  "profile_top",
  "inbox_top",
  "notes_input_top",
] as const;

// Below-the-fold placements lazy-load on scroll; the rest are eager.
const LAZY_KEYS = new Set<string>(["profile_bottom", "to_user", "profile_top"]);

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

  it("lazy-loads exactly the below-the-fold placements", () => {
    for (const key of EXPECTED_KEYS) {
      expect(adPlacements[key].lazy).toBe(LAZY_KEYS.has(key));
    }
  });
});
