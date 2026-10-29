import { describe, expect, it } from "vitest";
import { avatarDataUri } from "./avatar";

describe("avatarDataUri", () => {
  // Both sides of a chat and the share cards derive the avatar from the seed
  // alone, so the same seed must always draw the same creature.
  it("is deterministic for the same seed", () => {
    expect(avatarDataUri("NightOwl")).toBe(avatarDataUri("NightOwl"));
  });

  it("differs for different seeds", () => {
    expect(avatarDataUri("NightOwl")).not.toBe(avatarDataUri("EmberWolf"));
  });
});
