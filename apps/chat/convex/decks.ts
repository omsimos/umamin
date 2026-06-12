/** Game card decks — plain data shared by the Convex functions (cardId
 *  validation), the UI (rendering), and the mock transport. Card ids are part
 *  of the wire protocol: never reuse or repurpose one within a deploy window. */

export type DeckId = "this-or-that" | "would-you-rather";

export interface GameCard {
  id: string;
  deck: DeckId;
  /** Optional framing line above the options. */
  prompt?: string;
  optionA: string;
  optionB: string;
}

const WYR = "Would you rather…";

export const GAME_DECKS: Record<DeckId, GameCard[]> = {
  "this-or-that": [
    {
      id: "tot-coffee",
      deck: "this-or-that",
      optionA: "Coffee",
      optionB: "Tea",
    },
    {
      id: "tot-owl",
      deck: "this-or-that",
      optionA: "Early bird",
      optionB: "Night owl",
    },
    {
      id: "tot-beach",
      deck: "this-or-that",
      optionA: "Beach",
      optionB: "Mountains",
    },
    { id: "tot-call", deck: "this-or-that", optionA: "Call", optionB: "Text" },
    { id: "tot-dogs", deck: "this-or-that", optionA: "Dogs", optionB: "Cats" },
    {
      id: "tot-sweet",
      deck: "this-or-that",
      optionA: "Sweet",
      optionB: "Savory",
    },
    {
      id: "tot-summer",
      deck: "this-or-that",
      optionA: "Summer",
      optionB: "Winter",
    },
    {
      id: "tot-books",
      deck: "this-or-that",
      optionA: "Books",
      optionB: "Podcasts",
    },
    {
      id: "tot-city",
      deck: "this-or-that",
      optionA: "Big city",
      optionB: "Small town",
    },
    {
      id: "tot-cinema",
      deck: "this-or-that",
      optionA: "Cinema night",
      optionB: "Couch movie night",
    },
  ],
  "would-you-rather": [
    {
      id: "wyr-fly",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Fly",
      optionB: "Be invisible",
    },
    {
      id: "wyr-time",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Visit the past",
      optionB: "Visit the future",
    },
    {
      id: "wyr-minds",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Read minds",
      optionB: "Pause time",
    },
    {
      id: "wyr-animals",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Talk to animals",
      optionB: "Speak every language",
    },
    {
      id: "wyr-fame",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Be famous",
      optionB: "Be secretly rich",
    },
    {
      id: "wyr-media",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Live without music",
      optionB: "Live without movies",
    },
    {
      id: "wyr-food",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Eat your favorite food forever",
      optionB: "Never eat it again",
    },
    {
      id: "wyr-outcome",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Know every outcome",
      optionB: "Be surprised forever",
    },
    {
      id: "wyr-island",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Tropical island",
      optionB: "Cabin in the woods",
    },
    {
      id: "wyr-memory",
      deck: "would-you-rather",
      prompt: WYR,
      optionA: "Relive one day",
      optionB: "Erase one memory",
    },
  ],
};

export const DECK_META: Record<DeckId, { label: string; emoji: string }> = {
  "this-or-that": { label: "This or That", emoji: "⚡" },
  "would-you-rather": { label: "Would You Rather", emoji: "🤔" },
};

const CARDS_BY_ID = new Map<string, GameCard>(
  Object.values(GAME_DECKS)
    .flat()
    .map((c) => [c.id, c]),
);

export function cardById(id: string): GameCard | undefined {
  return CARDS_BY_ID.get(id);
}
