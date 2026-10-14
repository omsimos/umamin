/** UI metadata for the vibe levels (names, hues, unlock copy). The scoring
 *  itself lives in convex/vibe.ts — this is presentation only. */

export interface VibeLevelMeta {
  level: number;
  name: string;
  emoji: string;
  /** What entering this level unlocks; empty for the baseline. */
  unlocks: string;
  /** Ring gradient endpoints, cold to warm as the chemistry builds. */
  ring: [string, string];
}

export const VIBE_LEVELS: VibeLevelMeta[] = [
  {
    level: 1,
    name: "Breaking the ice",
    emoji: "🧊",
    unlocks: "",
    ring: ["#06b6d4", "#3b82f6"],
  },
  {
    level: 2,
    name: "Warming up",
    emoji: "🌤️",
    unlocks: "🔮 Mind Reader · 🫶 reaction",
    ring: ["#22d3ee", "#34d399"],
  },
  {
    level: 3,
    name: "Clicking",
    emoji: "⚡",
    unlocks: "🌶️ Hot Takes · ✨ Sparkles · 🥹 reaction",
    ring: ["#8b5cf6", "#a855f7"],
  },
  {
    level: 4,
    name: "Electric",
    emoji: "💫",
    unlocks: "🙊 Never Have I Ever · 💨 Poof",
    ring: ["#d946ef", "#ec4899"],
  },
  {
    level: 5,
    name: "Kindred",
    emoji: "💞",
    unlocks: "👑 Golden hearts",
    ring: ["#f472b6", "#db2777"],
  },
];

export function vibeLevelMeta(level: number): VibeLevelMeta {
  return (
    VIBE_LEVELS.find((l) => l.level === level) ??
    VIBE_LEVELS[VIBE_LEVELS.length - 1]
  );
}
