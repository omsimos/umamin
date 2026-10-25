import { MIN_ONLINE_SHOWN } from "./constants";
import type { ChatStats } from "./types";

/** People in Umamin Chat right now, or null when there's no headcount yet or
 *  it's too small to be worth showing. */
export function visibleOnline(
  stats: ChatStats | null | undefined,
): number | null {
  if (!stats) return null;
  const online = stats.waiting + stats.chatting;
  return online >= MIN_ONLINE_SHOWN ? online : null;
}
