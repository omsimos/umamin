import { describe, expect, it } from "vitest";
import { proThemeClass } from "../src/components/pro-flair";
import { canPostImages, MIN_AURA_FOR_IMAGES } from "../src/lib/post-images";
import { activeProTheme } from "../src/lib/pro";
import { hasPlusFeatures } from "../src/lib/utils";

// Anchored to the live clock: the helpers default to Date.now() internally.
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const FUTURE = new Date(NOW + 30 * DAY);
const PAST = new Date(NOW - DAY);
const PLUS_AGED = new Date(NOW - 400 * DAY);
const YOUNG = new Date(NOW - DAY);

// hasPlusFeatures drives BOTH the functional Plus perks (polls, group
// creation) and the avatar shine — one predicate so they can't disagree.
describe("hasPlusFeatures", () => {
  it("unlocks by account age alone", () => {
    expect(hasPlusFeatures({ createdAt: PLUS_AGED })).toBe(true);
  });

  it("unlocks a young account with an active Pro", () => {
    expect(hasPlusFeatures({ createdAt: YOUNG, proUntil: FUTURE })).toBe(true);
  });

  it("locks a young account whose Pro expired", () => {
    expect(hasPlusFeatures({ createdAt: YOUNG, proUntil: PAST })).toBe(false);
    expect(hasPlusFeatures(null)).toBe(false);
  });

  it("accepts the string dates cached JSON payloads deserialize to", () => {
    expect(hasPlusFeatures({ proUntil: FUTURE.toISOString() })).toBe(true);
  });
});

describe("canPostImages", () => {
  it("unlocks at the aura bar without Pro", () => {
    expect(canPostImages({ points: MIN_AURA_FOR_IMAGES })).toBe(true);
    expect(canPostImages({ points: MIN_AURA_FOR_IMAGES - 1 })).toBe(false);
  });

  it("lets an active Pro skip the aura bar entirely", () => {
    expect(canPostImages({ points: 0, proUntil: FUTURE })).toBe(true);
  });

  it("re-locks a zero-aura account once Pro expires", () => {
    expect(canPostImages({ points: 0, proUntil: PAST })).toBe(false);
  });

  it("keeps earned aura after Pro expires", () => {
    expect(canPostImages({ points: MIN_AURA_FOR_IMAGES, proUntil: PAST })).toBe(
      true,
    );
  });

  it("is false for an unknown viewer", () => {
    expect(canPostImages(null)).toBe(false);
    expect(canPostImages(undefined)).toBe(false);
  });
});

describe("activeProTheme", () => {
  it("returns the stored theme while Pro is active", () => {
    expect(activeProTheme({ proUntil: FUTURE, profileTheme: "ocean" })).toBe(
      "ocean",
    );
  });

  it("hides the theme after a lapse — the preference survives, the render stops", () => {
    expect(
      activeProTheme({ proUntil: PAST, profileTheme: "ocean" }),
    ).toBeNull();
  });

  it("rejects tokens outside the curated palette", () => {
    expect(
      activeProTheme({ proUntil: FUTURE, profileTheme: "glitter" }),
    ).toBeNull();
  });

  it("is null with no stored theme", () => {
    expect(activeProTheme({ proUntil: FUTURE, profileTheme: null })).toBeNull();
    expect(activeProTheme(undefined)).toBeNull();
  });
});

describe("proThemeClass", () => {
  it("maps an entitled theme to its scoped CSS class", () => {
    expect(proThemeClass({ proUntil: FUTURE, profileTheme: "ember" })).toBe(
      "profile-theme-ember",
    );
  });

  it("is undefined when lapsed, so the page wrapper renders unthemed", () => {
    expect(
      proThemeClass({ proUntil: PAST, profileTheme: "ember" }),
    ).toBeUndefined();
  });

  it("accepts the string dates cached JSON payloads deserialize to", () => {
    expect(
      proThemeClass({
        proUntil: FUTURE.toISOString(),
        profileTheme: "mono",
      }),
    ).toBe("profile-theme-mono");
  });
});
