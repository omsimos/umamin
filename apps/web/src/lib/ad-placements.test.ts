import { describe, expect, it } from "vitest";
import {
  AD_FREQUENCY,
  adPlacements,
  MAX_IN_FEED_ADS,
  shouldShowInFeedAd,
} from "./ad-placements";

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

// An initialized in-feed unit is a live iframe that nothing unmounts, so the
// one-per-8 rule has to stop somewhere or a deep scroll accumulates dozens.
describe("shouldShowInFeedAd", () => {
  it("places a unit every AD_FREQUENCY rows", () => {
    const shown = [...Array(AD_FREQUENCY * 2).keys()].filter(
      shouldShowInFeedAd,
    );
    expect(shown).toEqual([AD_FREQUENCY - 1, AD_FREQUENCY * 2 - 1]);
  });

  it("stops after MAX_IN_FEED_ADS units", () => {
    const lastAllowed = AD_FREQUENCY * MAX_IN_FEED_ADS - 1;
    expect(shouldShowInFeedAd(lastAllowed)).toBe(true);
    expect(shouldShowInFeedAd(lastAllowed + AD_FREQUENCY)).toBe(false);
  });

  it("caps the total over a deep scroll", () => {
    const overTwoHundredRows = [...Array(240).keys()].filter(
      shouldShowInFeedAd,
    ).length;
    expect(overTwoHundredRows).toBe(MAX_IN_FEED_ADS);
  });
});
