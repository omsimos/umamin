import type { MessageReaction } from "./session/types";

export interface ReactionGroup {
  emoji: string;
  count: number;
}

/** Collapse per-user reactions into emoji groups (first-seen order) so the
 *  badge renders a shared emoji once with a counter instead of repeating it. */
export function groupReactions(reactions: MessageReaction[]): ReactionGroup[] {
  const groups: ReactionGroup[] = [];
  for (const { emoji } of reactions) {
    const existing = groups.find((g) => g.emoji === emoji);
    if (existing) existing.count += 1;
    else groups.push({ emoji, count: 1 });
  }
  return groups;
}
