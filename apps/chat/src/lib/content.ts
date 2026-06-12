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

// Mirror of the server's ALLOWED_REACTIONS; 🫶/🥹 are vibe-level unlocks
// (REACTION_MIN_LEVEL in convex/constants.ts) and only appear once unlocked.
export const REACTION_EMOJIS = ["❤️", "😂", "🔥", "😮", "👍", "😢", "🫶", "🥹"];
