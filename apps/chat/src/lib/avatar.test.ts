import { describe, expect, it } from "vitest";
import { avatarGradient } from "./avatar";

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
