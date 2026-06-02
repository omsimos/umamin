export interface Interest {
  id: string;
  label: string;
  emoji: string;
}

export const INTERESTS: Interest[] = [
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "movies", label: "Movies", emoji: "🎬" },
  { id: "books", label: "Books", emoji: "📚" },
  { id: "deep-talks", label: "Deep talks", emoji: "💬" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "food", label: "Food", emoji: "🍜" },
  { id: "memes", label: "Memes", emoji: "😂" },
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "anime", label: "Anime", emoji: "🌸" },
];

const INTEREST_BY_ID = new Map(INTERESTS.map((i) => [i.id, i]));

export function interestById(id: string): Interest | undefined {
  return INTEREST_BY_ID.get(id);
}

export const ALIAS_ADJECTIVES = [
  "Wandering",
  "Quiet",
  "Midnight",
  "Velvet",
  "Golden",
  "Electric",
  "Hidden",
  "Cosmic",
  "Gentle",
  "Restless",
  "Lucid",
  "Amber",
  "Silver",
  "Wild",
];
export const ALIAS_NOUNS = [
  "Fox",
  "Owl",
  "Comet",
  "Wolf",
  "Ember",
  "Otter",
  "Falcon",
  "Moth",
  "Heron",
  "Lynx",
  "Raven",
  "Koi",
  "Sparrow",
  "Bear",
];

export const PARTNER_LINES = [
  "haha that's so real",
  "ooh tell me more",
  "honestly same",
  "wait that's actually interesting",
  "no way 😄",
  "i've been thinking about that too lately",
  "okay that's a hot take",
  "what got you into that?",
  "lol fair enough",
  "that's kind of the dream tbh",
];

export const MATCH_TIPS = [
  'a simple "hey, what are you into?" goes a long way.',
  "ask about the thing you both picked — instant common ground.",
  "no pressure — it's anonymous and nothing is saved.",
  "curiosity beats small talk. ask a real question.",
];

export const ICE_BREAKER_PROMPTS = [
  "What are you into lately?",
  "Hot take?",
  "How's your day going?",
];

export const REACTION_EMOJIS = ["❤️", "😂", "🔥", "😮", "👍", "😢"];
