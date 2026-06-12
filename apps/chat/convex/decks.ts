/** Game card decks — plain data shared by the Convex functions (cardId
 *  validation), the UI (rendering), and the mock transport. Card ids are part
 *  of the wire protocol: never reuse or repurpose one within a deploy window. */

export type DeckId =
  | "this-or-that"
  | "would-you-rather"
  | "hot-takes"
  | "never-have-i-ever";

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
  "hot-takes": [
    {
      id: "ht-pineapple",
      deck: "hot-takes",
      prompt: "Pineapple belongs on pizza.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-cereal",
      deck: "hot-takes",
      prompt: "Cereal is a soup.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-reply",
      deck: "hot-takes",
      prompt: "Replying instantly is attractive, not desperate.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-breakfast",
      deck: "hot-takes",
      prompt: "Breakfast food is the best food.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-home-movie",
      deck: "hot-takes",
      prompt: "Watching at home beats the cinema.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-cold-pizza",
      deck: "hot-takes",
      prompt: "Cold pizza beats reheated pizza.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-old-music",
      deck: "hot-takes",
      prompt: "Music peaked ten years ago.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-morning",
      deck: "hot-takes",
      prompt: "Morning people are doing life right.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-spoilers",
      deck: "hot-takes",
      prompt: "Spoilers don't actually ruin a story.",
      optionA: "Agree",
      optionB: "Disagree",
    },
    {
      id: "ht-hotdog",
      deck: "hot-takes",
      prompt: "A hot dog is a sandwich.",
      optionA: "Agree",
      optionB: "Disagree",
    },
  ],
  "never-have-i-ever": [
    {
      id: "nhie-ghosted",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… ghosted someone mid-conversation.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-cried-movie",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… cried at a movie.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-all-nighter",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… pulled an all-nighter for no good reason.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-fake-song",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… pretended to know a song.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-wrong-text",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… sent a text to the wrong person.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-binge",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… binged a whole series in one day.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-self-talk",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… had a full conversation with myself.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-floor-food",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… eaten something right off the floor.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-fake-laugh",
      deck: "never-have-i-ever",
      prompt: "Never have I ever… laughed at a joke I didn't get.",
      optionA: "I have",
      optionB: "Never",
    },
    {
      id: "nhie-rewatch",
      deck: "never-have-i-ever",
      prompt:
        "Never have I ever… rewatched a show instead of starting a new one.",
      optionA: "I have",
      optionB: "Never",
    },
  ],
};

export const DECK_META: Record<DeckId, { label: string; emoji: string }> = {
  "this-or-that": { label: "This or That", emoji: "⚡" },
  "would-you-rather": { label: "Would You Rather", emoji: "🤔" },
  "hot-takes": { label: "Hot Takes", emoji: "🌶️" },
  "never-have-i-ever": { label: "Never Have I Ever", emoji: "🙊" },
};

/** Vibe level required to deal from a deck (absent of any vibe = level 1).
 *  Content gates are enforced server-side in dealCard — the locked tiles in
 *  the play sheet are UX, not the guard. */
export const DECK_MIN_LEVEL: Record<DeckId, number> = {
  "this-or-that": 1,
  "would-you-rather": 1,
  "hot-takes": 3,
  "never-have-i-ever": 4,
};

/** Vibe level required to deal a round in guess mode (Mind Reader). */
export const GUESS_MODE_MIN_LEVEL = 2;

const CARDS_BY_ID = new Map<string, GameCard>(
  Object.values(GAME_DECKS)
    .flat()
    .map((c) => [c.id, c]),
);

export function cardById(id: string): GameCard | undefined {
  return CARDS_BY_ID.get(id);
}
