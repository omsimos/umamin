import { describe, expect, it } from "vitest";
import { avatarGradient, initialOf } from "./avatar";

describe("avatarGradient", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarGradient("NightOwl")).toEqual(avatarGradient("NightOwl"));
  });

  it("differs for different seeds", () => {
    expect(avatarGradient("NightOwl")).not.toEqual(avatarGradient("EmberWolf"));
  });

  it("returns a CSS linear-gradient background", () => {
    expect(avatarGradient("x").backgroundImage).toMatch(/^linear-gradient\(/);
  });
});

describe("initialOf", () => {
  it("uppercases the first letter", () => {
    expect(initialOf("nightOwl")).toBe("N");
  });

  it("falls back to '?' for empty input", () => {
    expect(initialOf("")).toBe("?");
  });
});
