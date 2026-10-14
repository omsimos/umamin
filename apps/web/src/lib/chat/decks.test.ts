import { describe, expect, it } from "vitest";
import {
  cardById,
  DECK_META,
  DECK_MIN_LEVEL,
  type DeckId,
  GAME_DECKS,
  GUESS_MODE_MIN_LEVEL,
} from "./decks";
import { MAX_VIBE_LEVEL } from "./vibe";

const decks = Object.keys(GAME_DECKS) as DeckId[];

describe("decks", () => {
  it("every deck has 10 cards with meta and a reachable level gate", () => {
    for (const deck of decks) {
      expect(GAME_DECKS[deck], deck).toHaveLength(10);
      expect(DECK_META[deck], deck).toBeDefined();
      expect(DECK_MIN_LEVEL[deck]).toBeGreaterThanOrEqual(1);
      expect(DECK_MIN_LEVEL[deck]).toBeLessThanOrEqual(MAX_VIBE_LEVEL);
      for (const card of GAME_DECKS[deck]) expect(card.deck).toBe(deck);
    }
  });

  it("at least one deck is open at level 1 and guess mode is reachable", () => {
    expect(decks.some((d) => DECK_MIN_LEVEL[d] === 1)).toBe(true);
    expect(GUESS_MODE_MIN_LEVEL).toBeLessThanOrEqual(MAX_VIBE_LEVEL);
  });

  it("card ids are globally unique and resolvable; unknown ids are not", () => {
    const all = Object.values(GAME_DECKS).flat();
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const card of all) expect(cardById(card.id)).toBe(card);
    expect(cardById("nope")).toBeUndefined();
  });
});
