import { describe, expect, it } from "vitest";
import { randomAlias, randomAvatarSeed } from "./alias";
import { ALIAS_ADJECTIVES, ALIAS_NOUNS } from "./mock/data";

describe("randomAlias", () => {
  it("joins an adjective and a noun from the word lists", () => {
    // random() === 0 picks the first of each.
    expect(randomAlias(() => 0)).toBe(
      `${ALIAS_ADJECTIVES[0]}${ALIAS_NOUNS[0]}`,
    );
  });

  it("produces a non-empty string with default randomness", () => {
    expect(randomAlias().length).toBeGreaterThan(0);
  });
});

describe("randomAvatarSeed", () => {
  it("returns distinct seeds across calls", () => {
    let n = 0;
    const r = () => (n++ % 1000) / 1000;
    expect(randomAvatarSeed(r)).not.toBe(randomAvatarSeed(r));
  });
});
