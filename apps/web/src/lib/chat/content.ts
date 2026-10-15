export interface Interest {
  id: string;
  label: string;
  emoji: string;
  /** Ice-breaker offered when both sides picked this interest. */
  opener: string;
}

export const INTERESTS: Interest[] = [
  {
    id: "music",
    label: "Music",
    emoji: "🎵",
    opener: "What have you been listening to lately?",
  },
  {
    id: "gaming",
    label: "Gaming",
    emoji: "🎮",
    opener: "What are you playing right now?",
  },
  {
    id: "movies",
    label: "Movies",
    emoji: "🎬",
    opener: "Seen anything good lately?",
  },
  {
    id: "books",
    label: "Books",
    emoji: "📚",
    opener: "What are you reading these days?",
  },
  {
    id: "deep-talks",
    label: "Deep talks",
    emoji: "💬",
    opener: "What's been on your mind lately?",
  },
  {
    id: "sports",
    label: "Sports",
    emoji: "⚽",
    opener: "Which sport do you play or follow?",
  },
  {
    id: "art",
    label: "Art",
    emoji: "🎨",
    opener: "Do you make art or mostly admire it?",
  },
  {
    id: "travel",
    label: "Travel",
    emoji: "✈️",
    opener: "Where's the next place you want to go?",
  },
  {
    id: "food",
    label: "Food",
    emoji: "🍜",
    opener: "What's the best thing you ate this week?",
  },
  {
    id: "memes",
    label: "Memes",
    emoji: "😂",
    opener: "Describe your week as a meme.",
  },
  {
    id: "tech",
    label: "Tech",
    emoji: "💻",
    opener: "Building anything cool lately?",
  },
  {
    id: "anime",
    label: "Anime",
    emoji: "🌸",
    opener: "What anime should I watch next?",
  },
];

const INTEREST_BY_ID = new Map(INTERESTS.map((i) => [i.id, i]));

export function interestById(id: string): Interest | undefined {
  return INTEREST_BY_ID.get(id);
}

export const MATCH_TIPS = [
  'a simple "hey, what are you into?" goes a long way.',
  "ask about the thing you both picked. Instant common ground.",
  "no pressure. It's anonymous and nothing is saved.",
  "curiosity beats small talk. ask a real question.",
];

/** Generic openers; the banner shows a couple, picked once per match. */
export const ICE_BREAKER_PROMPTS = [
  "How's your day going?",
  "What are you into lately?",
  "Best thing that happened this week?",
  "What's your comfort show?",
  "What song is stuck in your head?",
  "What are you looking forward to?",
  "Night owl or early bird?",
  "What's something you could talk about for hours?",
];

export { ALLOWED_REACTIONS as REACTION_EMOJIS } from "./constants";
