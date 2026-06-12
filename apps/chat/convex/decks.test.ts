import { describe, expect, it } from "vitest";
import { cardById, DECK_META, DECK_MIN_LEVEL, GAME_DECKS } from "./decks";

describe("decks", () => {
  it("every deck has 10 cards with meta and a level gate", () => {
    for (const [deck, cards] of Object.entries(GAME_DECKS)) {
      expect(cards, deck).toHaveLength(10);
      expect(DECK_META[deck as keyof typeof DECK_META]).toBeDefined();
      expect(
        DECK_MIN_LEVEL[deck as keyof typeof DECK_MIN_LEVEL],
      ).toBeGreaterThanOrEqual(1);
      for (const card of cards) expect(card.deck).toBe(deck);
    }
  });

  it("card ids are globally unique and resolvable", () => {
    const all = Object.values(GAME_DECKS).flat();
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const card of all) expect(cardById(card.id)).toBe(card);
  });
});
