import { describe, expect, it } from "vitest";
import { streakTier, streakToast } from "./streak";

describe("streakTier", () => {
  it.each([
    [0, "base"],
    [2, "base"],
    [6, "base"],
    [7, "week"],
    [29, "week"],
    [30, "month"],
    [89, "month"],
    [90, "quarter"],
    [400, "quarter"],
  ] as const)("puts a %i-day streak in the %s tier", (days, tier) => {
    expect(streakTier(days)).toBe(tier);
  });
});

describe("streakToast", () => {
  it("leaves the message alone below the display threshold", () => {
    expect(streakToast("Saved.", { streak: 1, streakDay: 1 })).toBe("Saved.");
  });

  it("adds the count between tiers", () => {
    expect(streakToast("Saved.", { streak: 8, streakDay: 1 })).toBe(
      "Saved. 8-day streak.",
    );
  });

  it.each([
    [7, "orange"],
    [30, "red"],
    [90, "purple"],
  ])("announces the new bolt color on day %i", (streak, color) => {
    expect(streakToast("Saved.", { streak, streakDay: 1 })).toBe(
      `Saved. ${streak}-day streak. Your bolt is ${color} now.`,
    );
  });
});
