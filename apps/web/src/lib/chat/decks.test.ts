import { describe, expect, it } from "vitest";
import {
  cardById,
  cardTitle,
  DECK_META,
  DECK_ORDER,
  type DeckId,
  drawCard,
  GAME_DECKS,
} from "./decks";

const decks = Object.keys(GAME_DECKS) as DeckId[];
const all = Object.values(GAME_DECKS).flat();

describe("decks", () => {
  it("every deck is offered, has meta, and owns its cards", () => {
    expect([...DECK_ORDER].sort()).toEqual([...decks].sort());
    for (const deck of decks) {
      expect(DECK_META[deck], deck).toBeDefined();
      for (const card of GAME_DECKS[deck]) expect(card.deck).toBe(deck);
    }
  });

  it("card ids are globally unique and resolvable; unknown ids are not", () => {
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const card of all) expect(cardById(card.id)).toBe(card);
    expect(cardById("nope")).toBeUndefined();
  });

  it("every card has two distinct options and a question to follow up with", () => {
    for (const card of all) {
      expect(card.optionA, card.id).not.toBe(card.optionB);
      expect(card.followUp.trim(), card.id).toMatch(/\?$/);
    }
  });

  it("titles a statement card by its statement and a choice card by its options", () => {
    const hotTake = GAME_DECKS["hot-takes"][0];
    const wyr = GAME_DECKS["would-you-rather"][0];
    expect(cardTitle(hotTake)).toBe(hotTake.prompt);
    expect(cardTitle(wyr)).toBe(`${wyr.optionA} or ${wyr.optionB}`);
  });
});

describe("drawCard", () => {
  it("never repeats a played card while the deck has fresh ones", () => {
    const deck = GAME_DECKS["hot-takes"];
    const played = new Set(deck.slice(0, -1).map((c) => c.id));
    for (let r = 0; r < 1; r += 0.1) {
      expect(drawCard("hot-takes", played, () => r)).toBe(deck.at(-1));
    }
  });

  it("reshuffles the whole deck once every card has been played", () => {
    const deck = GAME_DECKS["this-or-that"];
    const played = new Set(deck.map((c) => c.id));
    expect(deck).toContain(drawCard("this-or-that", played, () => 0.5));
  });

  it("mind reader draws from every deck", () => {
    const seen = new Set<DeckId>();
    const steps = all.length;
    for (let i = 0; i < steps; i += 1) {
      seen.add(drawCard("mind-reader", new Set(), () => i / steps).deck);
    }
    expect([...seen].sort()).toEqual([...decks].sort());
  });
});
