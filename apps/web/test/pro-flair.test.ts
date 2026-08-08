import { describe, expect, it } from "vitest";
import { proThemeClass } from "../src/components/pro-flair";
import { activeProTheme } from "../src/lib/pro";
import { hasPlusFeatures } from "../src/lib/utils";

// Anchored to the live clock: the helpers default to Date.now() internally.
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const FUTURE = new Date(NOW + 30 * DAY);
const PAST = new Date(NOW - DAY);
const PLUS_AGED = new Date(NOW - 400 * DAY);
const YOUNG = new Date(NOW - DAY);

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
